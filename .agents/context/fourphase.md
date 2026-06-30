# Frontend PDF Review Implementation Guide

## Objective

Implement an interactive PDF review experience.

The frontend is responsible for displaying the uploaded PDF, allowing users to inspect every detected entity, and providing a smooth review experience before the final PDF is generated.

The frontend **must never edit the PDF directly**.

---

# Responsibilities

The frontend should:

* Upload a PDF.
* Display the original PDF.
* Display detected entities as interactive overlays.
* Allow users to inspect every decision.
* Allow users to accept or modify redaction decisions.
* Request the final redacted PDF from the backend.
* Optionally run the Privacy Audit.

---

# User Flow

```text
Upload PDF
      │
      ▼
Choose AI Purpose
      │
      ▼
Generate Privacy Strategy
      │
      ▼
Click Analyze
      │
      ▼
Receive Analysis
      │
      ▼
Render Original PDF
      │
      ▼
Display Interactive Highlights
      │
      ▼
User Reviews Decisions
      │
      ├───────────────┐
      ▼               ▼
Run Privacy Audit   Download Redacted PDF
```

---

# PDF Rendering

Use **react-pdf** for rendering.

Requirements:

* Display every page.
* Preserve the original appearance.
* Support scrolling through all pages.
* Keep text selectable if possible.
* Render quickly for large PDFs.

The rendered PDF should always be the original uploaded document.

---

# Highlight Layer

Do not modify the rendered PDF.

Instead, render a separate overlay above the PDF.

The overlay is responsible for:

* Highlighting detected entities.
* Hover effects.
* Click interactions.
* Showing current decision state.

Possible highlight states:

* Redacted
* Kept
* Needs Review

---

# Entity Interaction

Clicking a highlighted entity should open a side panel or modal.

Display:

* Entity value
* Entity type
* Confidence
* Explanation
* Recommendation
* Detection source
* Selected privacy strategy

Provide actions:

* Keep
* Redact

Changing the decision should only update the frontend review state.

No backend request is required until export.

---

# Review State

Maintain a local review state.

Each entity should store:

* Current decision
* Original recommendation
* Whether the user modified it

The frontend should always render the latest review state.

---

# Analyze

When the user clicks **Analyze**:

Send:

* Uploaded PDF
* Selected purpose
* Generated privacy strategy

Receive:

* Entity list
* Explanations
* Confidence
* Recommendations

After receiving the response:

* Hide the upload screen.
* Open the review interface.
* Render the uploaded PDF.
* Apply interactive highlights.

---

# Download Redacted PDF

When the user clicks **Download Redacted PDF**:

Send:

* Original uploaded PDF
* Final review decisions

The backend returns:

* Permanently redacted PDF

Trigger the browser download.

Do not generate the PDF on the frontend.

---

# Privacy Audit

Provide an optional action below the review screen.

Example:

```
Still have doubts?

[ Run Privacy Audit ]
```

When clicked:

Send:

* Final review decisions
* Selected privacy strategy

Display:

* Audit Status
* Residual Risk
* Remaining Identifiers
* Explanations

The audit does not modify the PDF.

---

# Suggested Layout

```
----------------------------------------------------

Toolbar

----------------------------------------------------

Original PDF

(interactive highlights)

----------------------------------------------------

Right Sidebar

Entity Details

- Type
- Confidence
- Explanation
- Recommendation

Actions

[ Keep ]

[ Redact ]

----------------------------------------------------

Bottom Actions

[ Run Privacy Audit ]

[ Download Redacted PDF ]

----------------------------------------------------
```

---

# Frontend Principles

* Never edit the displayed PDF directly.
* Keep the review interface responsive.
* Prioritize explainability over automation.
* Make every highlighted entity clickable.
* The backend owns all document processing.
* The frontend owns the review experience.
* Download the final PDF only after the user finishes reviewing.
