# PDF Review Integration Plan

## Objective

Replace the current text-only workflow with a PDF-first workflow while keeping the existing PII detection pipeline unchanged.

The PDF should be rendered in the frontend, allow users to inspect every detected entity, and only generate the final redacted PDF after user approval.

---

# Architecture

```text
                Upload PDF
                     │
                     ▼
              FastAPI Backend
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
 Extract Text             Store Original PDF
 (PyMuPDF)
         │
         ▼
 Existing PII Pipeline
 (Presidio + LLM)
         │
         ▼
 Return
 - extracted text
 - detected entities
 - explanations
 - confidence
 - page number
 - coordinates (future if needed)
         │
         ▼
 Next.js Frontend
         │
         ▼
 react-pdf renders original PDF
         │
         ▼
 Highlight detected entities
         │
         ▼
 User reviews every decision
         │
         ▼
 User edits decisions if necessary
         │
         ▼
 Generate Final Redacted PDF
```

---

# Backend Responsibilities

## Upload Endpoint

Accept PDF uploads.

Extract text using PyMuPDF.

The backend should continue using the existing detection pipeline.

No changes are required to the Presidio or LLM logic.

---

## Processing Flow

```text
PDF

↓

PyMuPDF

↓

Extract Text

↓

Presidio

↓

LLM

↓

Return JSON
```

Return:

* original extracted text
* anonymized text
* entities
* explanations
* confidence
* recommendations

The original uploaded PDF should be retained temporarily until export.

---

# Frontend Responsibilities

Use **react-pdf** to display the uploaded PDF.

This is a review interface, not a PDF editor.

Users should see the original PDF exactly as it appears.

---

# Review Experience

Each detected entity should be interactive.

When the user clicks a highlighted entity:

Display:

* Entity Type
* Confidence
* Explanation
* Recommendation
* Selected Privacy Policy

Allow:

* Keep
* Redact

The user's decision should update the current review state.

---

# Important

Do **not** modify the PDF during review.

The PDF displayed in the browser remains the original document.

Only the review decisions are updated.

---

# Export

When the user clicks **Generate Redacted PDF**:

Send:

* Original PDF
* Final review decisions

The backend should:

* Open the original PDF
* Apply permanent redactions
* Generate a new PDF
* Return the redacted document

---

# Future Improvements

Future versions may include:

* Exact PDF coordinate mapping for highlights
* Page thumbnails
* Side-by-side original and redacted preview
* Privacy Audit feature
* Downloadable trust report

These are out of scope for the current implementation.

---

# Implementation Notes

* Continue using the existing API contract wherever possible.
* The PDF upload should simply replace the current text input.
* The detection pipeline should remain unchanged.
* Keep the UI focused on review and explainability rather than PDF editing.
* Generate the redacted PDF only after the user confirms the review.
