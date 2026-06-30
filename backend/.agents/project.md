# Conseal Hackathon – Problem Statement 1 (Trust & Explainability)

## Project Overview

We are building a full-stack application inspired by **Conseal**, a privacy-first document anonymization tool.

The real Conseal application performs all PII detection locally so sensitive information never leaves the user's machine. However, for this hackathon, cloud APIs and LLMs are allowed.

Our goal is **NOT** to build the best PII detector.

Our goal is to solve **Problem Statement 1 – Trust & Explainability**.

---

# Problem Statement

Marcus wants to share a sensitive document with an external AI (ChatGPT, Gemini, Claude, etc.) but does not trust automatic redaction tools.

His concerns are:

* Did the software actually remove the sensitive information?
* Why was something redacted?
* Why wasn't something else redacted?
* Can hidden text still be extracted?
* Can I trust this tool?

Our application should reduce anxiety and increase trust by making every decision transparent and explainable.

---

# Core Principle

Detection is only the beginning.

The primary objective is helping the user understand and trust every redaction decision.

---

# User Flow

```
Upload Document
        │
        ▼
Extract Text
        │
        ▼
PII Detection
        │
        ▼
Review & Explain
        │
        ▼
Generate Redacted Document
        │
        ▼
Privacy Verification
        │
        ▼
Download Safe Document
```

---

# MVP Architecture

```
                Upload PDF / DOC or text
                       │
                       ▼
              Text Extraction Layer
                       │
                       ▼
     Microsoft Google Cloud Sensitive Data Protection (Primary Detector)
        ├── Regex
        ├── spaCy NER
        └── Built-in Recognizers
                       │
                       ▼
          Candidate PII + Confidence
                       │
                       ▼
              LLM Context Review
        - Find contextual PII
        - Explain decisions
        - Detect ambiguous entities
                       │
                       ▼
             Final Redaction Decision
                       │
                       ▼
              Explainability Layer
                       │
                       ▼
             Export Redacted Document
```

---

# Technologies


## Backend

* FastAPI
* Microsoft Google Cloud Sensitive Data Protection
* spaCy (`en_core_web_sm`) initially
* Gemini/OpenAI (for contextual reasoning)

---

# Detection Strategy

## Layer 1

Microsoft Google Cloud Sensitive Data Protection

Responsibilities

* Detect emails
* Detect phone numbers
* Detect addresses
* Detect names
* Detect IDs
* Return confidence score
* Return recognizer metadata

This is considered the primary detector.

---

## Layer 2

LLM Context Review

The LLM acts as a secondary reasoning layer that enhances detection and provides context-aware explanations, while still aligning with and supporting the outputs from Layer 1 (Google Cloud Sensitive Data Protection).

Instead it should:

* Identify contextual or indirect identifiers that deterministic methods may miss.
* Provide clear reasoning for why an entity should be redacted.
* Provide justification for why an entity can remain visible.
* Help resolve ambiguous or borderline cases using document context.

Example:

```
Google

Detected as Organization

Context:
Employment Contract

Reason:
Employer name may indirectly identify the individual.

Recommendation:
Redact
```

---

# MVP Features

## 1. Upload Document

Support:

* PDF
* Text
* (DOCX later)

---

## 2. Detect PII

Display detected entities with:

* Type
* Confidence
* Location in document

---

## 3. Explain Every Redaction

Clicking a highlighted entity should show:

```
Entity

John Smith

Detected As

PERSON

Confidence

98%

Detected By

Google Cloud Sensitive Data Protection

Reason

Appears as a personal name.
```

---

## 4. Explain Why Something Was NOT Redacted

Example

```
Google

Status

Visible

Reason

Organization names are allowed
under the selected privacy policy.
```

This directly answers the problem statement:

> Why this, and why not that?

---

## 5. Redacted Preview

Allow users to compare:

Original

↓

Redacted

---

## 6. Export

Generate a permanently redacted document.

---

# Design Philosophy

The application should feel like an explainable assistant rather than a black-box AI.

Every decision should have a reason.

The user should never wonder:

* Why?
* How?
* Can I trust this?

---

# Out of Scope (MVP)

Do NOT build:

* Local LLM inference
* Custom NER training
* Complex authentication
* Collaboration
* Batch processing
* OCR optimization
* Advanced policy engine

Those can be future enhancements.

---

# Future Enhancements

These should NOT block the MVP.

## Privacy Audit

After generating the redacted document:

```
Redacted Document

↓

Regex Scan

↓

Google Cloud Sensitive Data Protection Scan

↓

LLM Privacy Auditor

↓

PASS / FAIL
```

Generate a residual privacy risk report.

---

## Trust Dashboard

Potential widgets:

* Overall Confidence
* Residual Risk
* Detection Summary
* Privacy Audit Status
* Explanation History
* Download Verification Report

---

## Policy Profiles

Different redaction policies for:

* Resume
* Medical
* Legal
* Financial
* HR

---

# Success Criteria

A successful MVP should allow Marcus to:

* Upload a sensitive document or text.
* Understand every redaction.
* Understand every non-redaction.
* Review confidence and explanations.
* Download a redacted version confidently.

The product should prioritize **trust, transparency, and explainability** over maximizing PII detection accuracy.
