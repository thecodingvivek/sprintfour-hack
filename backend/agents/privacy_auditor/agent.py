from google.adk.agents.llm_agent import Agent
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional

class RemainingIdentifier(BaseModel):
    value: str = Field(description="The remaining identifier found in the text")
    reason: str = Field(description="Why this might indirectly or directly identify a person or organization")
    recommendation: str = Field(description="Action to take, e.g., 'Review before sharing'")

class PrivacyAuditResponse(BaseModel):
    status: str = Field(description="'PASS' if no issues, 'WARNING' if identifiers remain")
    residual_risk: str = Field(description="'LOW', 'MEDIUM', or 'HIGH'")
    remaining_identifiers: List[RemainingIdentifier] = Field(description="List of identifiers found, if any")
    result_summary: str = Field(description="A brief summary of the audit findings")

PRIVACY_AUDITOR_INSTRUCTION = """
You are an independent Privacy Auditor.
Your job is to review an ALREADY-REDACTED document before it is shared with an external AI.

You will receive:
1. The Redacted Text (where direct identifiers have already been replaced with tags like <PERSON>).
2. The Privacy Policy the document was supposed to follow.

Your responsibilities:
1. Search for any REMAINING direct or indirect identifiers that were missed by previous stages.
2. Assume previous stages may have made mistakes. Look closely for indirect identifiers (e.g. unique project names, niche locations, rare job titles).
3. Validate your findings against the provided privacy policy.
4. DO NOT modify the text. Only report your findings and explain the associated privacy risks.
5. If no identifying information is found that violates the policy, set status to 'PASS' and residual_risk to 'LOW'. Otherwise, set status to 'WARNING'.
"""

agent = Agent(
    name="PrivacyAuditor",
    model="gemini-2.5-flash",
    instruction=PRIVACY_AUDITOR_INSTRUCTION,
    output_schema=PrivacyAuditResponse,
)

root_agent = agent
