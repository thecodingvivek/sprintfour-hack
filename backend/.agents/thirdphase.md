# Conseal Hackathon – Phase 3 (Optional Privacy Audit)

## Goal

Introduce an **optional trust feature** that allows users to independently verify the final redacted document before sharing it with an external AI.

This feature is **not part of the core redaction pipeline**. It exists to give skeptical users additional confidence.

---

# Design Philosophy

The primary workflow should remain fast and simple.

The Privacy Audit should be available only when the user wants additional assurance.

This directly addresses Marcus's concern:

> "I don't want to trust the tool blindly."

Instead of forcing another AI step, we allow the user to request an independent verification.

---

# Updated Architecture

```text
Main Pipeline

Provide Text
      │
      ▼
Select AI Purpose
      │
      ▼
Policy Generation Agent
      │
      ▼
Privacy Strategy
      │
      ▼
PII Detection (Presidio)
      │
      ▼
LLM Context Review
      │
      ▼
Explain Decisions
      │
      ▼
Generate Redacted Document
```

The pipeline ends here.

---

# Optional Trust Feature

After the redacted document is generated, provide an additional verification option.

Example UI

```text
✓ Your document is ready.

Still have doubts?

[ Run Independent Privacy Audit ]
```

or

```text
Need extra confidence before sharing?

[ Verify Before Sharing ]
```

---

# Privacy Audit Agent

Create a dedicated ADK agent that independently reviews the **already redacted** document.

The Privacy Audit Agent must **never modify** the document.

Its responsibilities are:

* Review the final redacted document.
* Assume it is about to be shared with an external AI.
* Search for any remaining direct or indirect identifiers.
* Validate the document against the selected privacy strategy.
* Produce a trust report.

---

# Privacy Audit Prompt

The audit agent should assume previous stages may have made mistakes.

Example instruction:

> Review this already-redacted document as if it is about to be uploaded to an external AI. Find any remaining information that could directly or indirectly identify a person or organization according to the selected privacy strategy. Do not modify the document. Only report your findings and explain the associated privacy risks.

---

# Privacy Audit Output

If the audit succeeds

```text
Privacy Audit

Status

PASS

Residual Risk

LOW

Remaining Identifiers

None

Result

No identifying information was found that violates the selected privacy strategy.
```

If the audit finds issues

```text
Privacy Audit

Status

WARNING

Residual Risk

MEDIUM

Remaining Identifier

Project Falcon

Reason

This project name may indirectly identify the organization.

Recommendation

Review before sharing.
```

---

# MVP Additions

Add:

* Independent Privacy Audit Agent
* "Verify Before Sharing" action
* Residual Privacy Risk Report
* Human-readable audit explanations

---

# Why This Feature Exists

This feature is designed to increase user trust, not detection accuracy.

Instead of asking users to trust the redaction process blindly, it gives them the option to independently verify the document before sharing it with an external AI.

The audit acts as a second opinion rather than another mandatory processing step.
