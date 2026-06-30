# Conseal Hackathon – PS1 MVP (Updated)

## Goal

Build an explainable document anonymization tool that helps users confidently share documents with external AI tools.

The focus is **trust**, not just PII detection.

---

# User Flow

```text
Provide your document
        │
        ▼
Select the purpose for using AI
        │
        ▼
Create a privacy strategy
        │
        ▼
Detect sensitive information (Presidio)
        │
        ▼
Review context and refine decisions (LLM)
        │
        ▼
Explain each decision clearly
        │
        ▼
Produce the redacted document
```

---

# Step 1 — Purpose Selection

Before detecting PII, ask the user:

> **What is the purpose of sharing this document with AI?**

Examples:

* Resume Review
* Contract Analysis
* Medical Analysis
* Financial Analysis
* General AI Chat
* Custom

This purpose determines what information should be preserved and what should be hidden.

---

# Step 2 — Privacy Policy

Based on the selected purpose, generate a redaction policy.

create an adk agent to create policy and assing each policy as point 1,2,3 etc

Example:

### Resume Review

Hide

* Name
* Email
* Phone
* Address

Keep

* Skills
* Projects
* Experience
* Certifications

Review

* Company Names

The user can modify this policy before continuing.

---

# Step 3 — Layer 1: PII Detection

Use **Microsoft Presidio** as the primary PII detection engine.

Responsibilities:

* Detect standard PII
* Return confidence scores
* Perform deterministic detection
* Produce the initial list of entities

---

# Step 4 — Layer 2: LLM Context Review

The LLM is **not** responsible for replacing Presidio.

Instead it should:

* Detect contextual identifiers Presidio may miss.
* Resolve ambiguous entities.
* Generate human-readable explanations.
* Validate decisions against the selected privacy policy.

---

# Step 5 — Explainability

Every entity should answer:

* Why was this hidden?
* Why was this kept?
* Which layer detected it?
* What confidence was assigned?
* How does this relate to the selected purpose via policy?

---

# MVP Features

* Upload text
* Purpose selection
* Editable privacy policy
* Presidio detection
* LLM contextual review
* Side-by-side original and redacted view
* Entity explanations
* Export redacted document