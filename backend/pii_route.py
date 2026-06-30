from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pii.analyzer import analyzer
from pii.anonymizer import anonymizer
from common.config.adk import get_runner
from google.genai import types
from presidio_analyzer import RecognizerResult
from typing import List, Optional
import uuid
import json
import io

router = APIRouter()

# --- Request/Response Models ---

class PrivacyPolicy(BaseModel):
    hide: List[str] = []
    keep: List[str] = []
    review: List[str] = []

class PolicyRequest(BaseModel):
    purpose: str

class PolicyResponse(BaseModel):
    purpose: str
    policy: PrivacyPolicy

class PIIRequest(BaseModel):
    text: str
    purpose: Optional[str] = None
    policy: Optional[PrivacyPolicy] = None

class PIIEntity(BaseModel):
    type: str
    start: int
    end: int
    score: float
    value: str
    explanation: str
    risk_level: str
    recommendation: str
    detected_by: str  # "presidio" or "llm"
    applied_policy_rule: Optional[str] = None

class NonRedactedItem(BaseModel):
    value: str
    type: str
    explanation: str
    reason_kept: str

class PIIResponse(BaseModel):
    original_text: str
    anonymized_text: str
    entities: List[PIIEntity]
    non_redacted: List[NonRedactedItem]
    overall_risk_summary: str

class AuditRequest(BaseModel):
    redacted_text: str
    policy: Optional[PrivacyPolicy] = None

class RemainingIdentifier(BaseModel):
    value: str
    reason: str
    recommendation: str

class AuditResponse(BaseModel):
    status: str
    residual_risk: str
    remaining_identifiers: List[RemainingIdentifier]
    result_summary: str


# --- Helper: Run Layer 2 LLM Explanation ---

async def _generate_policy(purpose: str) -> dict:
    runner = get_runner("policy_generator")
    session = await runner.session_service.create_session(
        app_name="policy_generator",
        user_id="anonymous",
        session_id=str(uuid.uuid4()),
    )
    new_message = types.Content(
        role="user",
        parts=[types.Part(text=f"Purpose: {purpose}")],
    )
    response_text = ""
    async for event in runner.run_async(
        user_id="anonymous",
        session_id=session.id,
        new_message=new_message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    try:
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        return {"purpose": purpose, "policy": {"hide": [], "keep": [], "review": []}}


async def _run_privacy_audit(redacted_text: str, policy: Optional[dict] = None) -> dict:
    """Send redacted text to the Privacy Auditor agent."""
    runner = get_runner("privacy_auditor")
    session = await runner.session_service.create_session(
        app_name="privacy_auditor",
        user_id="anonymous",
        session_id=str(uuid.uuid4()),
    )
    
    policy_str = ""
    if policy:
        policy_str = f"Privacy Policy:\n{json.dumps(policy, indent=2)}\n\n"
        
    prompt = (
        f"Analyze the following REDACTED text.\n\n"
        f"{policy_str}"
        f"Redacted Text:\n{redacted_text}\n"
    )
    
    new_message = types.Content(
        role="user",
        parts=[types.Part(text=prompt)],
    )
    
    response_text = ""
    async for event in runner.run_async(
        user_id="anonymous",
        session_id=session.id,
        new_message=new_message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    try:
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        return {
            "status": "WARNING",
            "residual_risk": "HIGH",
            "remaining_identifiers": [],
            "result_summary": "Failed to generate audit report."
        }


async def _get_llm_explanations(text: str, detected_entities: list, purpose: Optional[str] = None, policy: Optional[dict] = None) -> dict:
    """Send detected PII to the ADK explainer agent for contextual reasoning."""
    runner = get_runner("pii_explainer")

    session = await runner.session_service.create_session(
        app_name="pii_explainer",
        user_id="anonymous",
        session_id=str(uuid.uuid4()),
    )

    policy_str = ""
    if purpose or policy:
        policy_str = f"Intended Purpose: {purpose or 'Not specified'}\nUser Privacy Policy:\n{json.dumps(policy, indent=2)}\n\n"

    prompt = (
        f"Analyze the following text and PII detection results.\n\n"
        f"{policy_str}"
        f"Original Text:\n{text}\n\n"
        f"Detected PII Entities:\n{json.dumps(detected_entities, indent=2)}\n\n"
        f"Provide explanations for each detected entity and identify notable non-redacted items."
    )

    new_message = types.Content(
        role="user",
        parts=[types.Part(text=prompt)],
    )

    response_text = ""
    async for event in runner.run_async(
        user_id="anonymous",
        session_id=session.id,
        new_message=new_message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    # Parse the JSON response from the LLM
    try:
        # Try to extract JSON from the response (handle markdown code fences)
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            # Remove markdown code fences
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        # Fallback if LLM doesn't return valid JSON
        return {
            "entity_explanations": [],
            "non_redacted_explanations": [],
            "overall_risk_summary": "Could not generate detailed explanations. Review entities manually."
        }


# --- Helper: Run the full pipeline ---

async def _run_pii_pipeline(text: str, purpose: Optional[str] = None, policy: Optional[dict] = None) -> dict:
    """Run Layer 1 (Presidio) + Layer 2 (LLM) and return combined results."""

    # Layer 1: Presidio Detection
    results = analyzer.analyze(
        text=text,
        language="en",
        score_threshold=0.91
    )

    # Prepare entity data for Layer 2
    detected_entities = []
    for r in results:
        detected_entities.append({
            "type": r.entity_type,
            "value": text[r.start:r.end],
            "start": r.start,
            "end": r.end,
            "score": r.score
        })

    # Layer 2: LLM Context Review
    llm_result = await _get_llm_explanations(text, detected_entities, purpose, policy)

    # Build a lookup from the LLM explanations
    llm_entity_map = {}
    for e in llm_result.get("entity_explanations", []):
        key = (e.get("entity_type", ""), e.get("value", ""))
        llm_entity_map[key] = e

    # Process missed entities from Layer 2
    # Find their positions in the text and create RecognizerResult objects
    missed_results = []
    for missed in llm_result.get("missed_entities", []):
        value = missed.get("value", "")
        entity_type = missed.get("entity_type", "UNKNOWN")
        if not value:
            continue

        # Find all occurrences of the missed entity in the text
        start_idx = 0
        while True:
            pos = text.find(value, start_idx)
            if pos == -1:
                break
            # Check it's not already covered by Presidio
            already_covered = any(
                r.start <= pos and r.end >= pos + len(value)
                for r in results
            )
            if not already_covered:
                missed_results.append(
                    RecognizerResult(
                        entity_type=entity_type,
                        start=pos,
                        end=pos + len(value),
                        score=0.85,  # LLM-detected entities get a slightly lower score
                    )
                )
            start_idx = pos + len(value)

    # Combine Presidio results + LLM missed entities
    all_results = list(results) + missed_results

    # Merge Layer 1 results with Layer 2 explanations
    entities = []
    for r in results:
        value = text[r.start:r.end]
        llm_info = llm_entity_map.get((r.entity_type, value), {})
        entities.append(PIIEntity(
            type=r.entity_type,
            start=r.start,
            end=r.end,
            score=r.score,
            value=value,
            explanation=llm_info.get("explanation", f"Detected as {r.entity_type} with {r.score:.0%} confidence."),
            risk_level=llm_info.get("risk_level", "medium"),
            recommendation=llm_info.get("recommendation", "redact"),
            detected_by="presidio",
            applied_policy_rule=llm_info.get("applied_policy_rule")
        ))

    # Add missed entities from LLM to the entity list
    missed_entity_map = {}
    for m in llm_result.get("missed_entities", []):
        key = (m.get("entity_type", ""), m.get("value", ""))
        missed_entity_map[key] = m

    for r in missed_results:
        value = text[r.start:r.end]
        llm_info = missed_entity_map.get((r.entity_type, value), {})
        entities.append(PIIEntity(
            type=r.entity_type,
            start=r.start,
            end=r.end,
            score=r.score,
            value=value,
            explanation=llm_info.get("explanation", f"Detected by LLM as {r.entity_type}. Missed by Presidio."),
            risk_level=llm_info.get("risk_level", "high"),
            recommendation=llm_info.get("recommendation", "redact"),
            detected_by="llm",
            applied_policy_rule=llm_info.get("applied_policy_rule")
        ))

    # Non-redacted explanations from LLM
    non_redacted = []
    for item in llm_result.get("non_redacted_explanations", []):
        non_redacted.append(NonRedactedItem(
            value=item.get("value", ""),
            type=item.get("type", "UNKNOWN"),
            explanation=item.get("explanation", ""),
            reason_kept=item.get("reason_kept", "")
        ))

    # Anonymize the text with ALL entities (Presidio + LLM)
    safe_text = anonymizer.anonymize(
        text=text,
        analyzer_results=all_results
    )

    return {
        "original_text": text,
        "anonymized_text": safe_text.text,
        "entities": entities,
        "non_redacted": non_redacted,
        "overall_risk_summary": llm_result.get("overall_risk_summary", "")
    }


# --- Routes ---

@router.post("/audit", response_model=AuditResponse)
async def run_audit(request: AuditRequest):
    """Run an independent privacy audit on already redacted text."""
    policy_dict = request.policy.model_dump() if request.policy else None
    result = await _run_privacy_audit(request.redacted_text, policy_dict)
    return AuditResponse(**result)


@router.post("/policy", response_model=PolicyResponse)
async def generate_policy(request: PolicyRequest):
    """Generate a privacy policy based on a given purpose."""
    result = await _generate_policy(request.purpose)
    return PolicyResponse(**result)


@router.post("/anonymize", response_model=PIIResponse)
async def anonymize_text(request: PIIRequest):
    """Analyze text for PII, explain every decision, and return anonymized text."""
    policy_dict = request.policy.model_dump() if request.policy else None
    result = await _run_pii_pipeline(request.text, request.purpose, policy_dict)
    return PIIResponse(**result)


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    purpose: Optional[str] = Form(None),
    policy_json: Optional[str] = Form(None)
):
    """Upload a text or PDF document for PII analysis."""
    
    policy_dict = None
    if policy_json:
        try:
            policy_dict = json.loads(policy_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid policy JSON format.")
            
    content = await file.read()

    if file.content_type == "application/pdf" or (file.filename and file.filename.endswith(".pdf")):
        try:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text() + "\n"
            if not text.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from the PDF.")
        except ImportError:
            raise HTTPException(status_code=500, detail="PDF support requires PyMuPDF. Install it with: pip install PyMuPDF")
    else:
        # Treat as plain text
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File is not valid UTF-8 text.")

    result = await _run_pii_pipeline(text, purpose, policy_dict)
    return PIIResponse(**result)


@router.post("/export")
async def export_redacted(request: PIIRequest):
    """Generate and download a redacted text file."""
    # Run Layer 1 only for export (no need for LLM explanations)
    results = analyzer.analyze(
        text=request.text,
        language="en",
        score_threshold=0.91
    )

    safe_text = anonymizer.anonymize(
        text=request.text,
        analyzer_results=results
    )

    # Return as downloadable text file
    buffer = io.BytesIO(safe_text.text.encode("utf-8"))
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=redacted_document.txt"}
    )


@router.post("/export_pdf")
async def export_redacted_pdf(
    file: UploadFile = File(...),
    redactions_json: str = Form(...)
):
    """Generate and download a redacted PDF file based on user review decisions."""
    try:
        redactions = json.loads(redactions_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid redactions JSON format.")

    content = await file.read()
    if not (file.content_type == "application/pdf" or (file.filename and file.filename.endswith(".pdf"))):
         raise HTTPException(status_code=400, detail="File must be a PDF.")

    try:
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        for page in doc:
            for item in redactions:
                text_to_redact = item.get("value")
                entity_type = item.get("type", "REDACTED")
                action = item.get("action", "redact")
                if text_to_redact:
                    areas = page.search_for(text_to_redact)
                    for area in areas:
                        if action == "anonymize":
                            # White background, black text to visually replace with tag
                            page.add_redact_annot(area, text=f"<{entity_type}>", fill=(1, 1, 1), text_color=(0, 0, 0))
                        else:
                            # Black rectangle, completely hidden
                            page.add_redact_annot(area, fill=(0, 0, 0))
            page.apply_redactions()

        # Save to buffer
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=redacted_{file.filename or 'document.pdf'}"}
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF support requires PyMuPDF. Install it with: pip install PyMuPDF")
