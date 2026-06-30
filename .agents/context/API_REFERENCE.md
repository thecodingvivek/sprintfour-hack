# Conseal API Reference

Base URL: `http://localhost:8000`

---

## 1. `POST /pii/policy` (NEW)

Generate a privacy policy based on a given purpose (e.g., "Resume Review", "Contract Analysis").

### Request

**Content-Type:** `application/json`

```json
{
  "purpose": "string (required)"
}
```

### Response `200 OK`

```json
{
  "purpose": "string",
  "policy": {
    "hide": [
      "1. Name",
      "2. Email Address",
      "3. Phone Number"
    ],
    "keep": [
      "1. Skills",
      "2. Work Experience"
    ],
    "review": [
      "1. Company Names"
    ]
  }
}
```

---

## 2. `POST /pii/anonymize`

Analyze text for PII, explain every redaction decision, and return anonymized text.

### Request

**Content-Type:** `application/json`

```json
{
  "text": "string (required)",
  "purpose": "string (optional)",
  "policy": {
    "hide": ["string"],
    "keep": ["string"],
    "review": ["string"]
  }
}
```
*(Note: `policy` is optional, but if provided, it should match the output of `/pii/policy`)*

### Response `200 OK`

```json
{
  "original_text": "string",
  "anonymized_text": "string",
  "entities": [
    {
      "type": "string",
      "start": 0,
      "end": 0,
      "score": 0.0,
      "value": "string",
      "explanation": "string",
      "risk_level": "high | medium | low",
      "recommendation": "redact | review | keep",
      "detected_by": "dlp | llm",
      "applied_policy_rule": "string | null"
    }
  ],
  "non_redacted": [
    {
      "value": "string",
      "type": "string",
      "explanation": "string",
      "reason_kept": "string"
    }
  ],
  "overall_risk_summary": "string"
}
```

### Example

**Request:**
```json
{
  "text": "My name is John Smith. Email is john@gmail.com. Phone is 9876543210."
}
```

**Response:**
```json
{
  "original_text": "My name is John Smith. Email is john@gmail.com. Phone is 9876543210.",
  "anonymized_text": "My name is <PERSON>. Email is <EMAIL_ADDRESS>. Phone is <PHONE_NUMBER>.",
  "entities": [
    {
      "type": "EMAIL_ADDRESS",
      "start": 32,
      "end": 46,
      "score": 1.0,
      "value": "john@gmail.com",
      "explanation": "An email address is a direct personal identifier.",
      "risk_level": "high",
      "recommendation": "redact",
      "detected_by": "dlp",
      "applied_policy_rule": "2. Email Address"
    },
    {
      "type": "PERSON",
      "start": 11,
      "end": 21,
      "score": 0.85,
      "value": "John Smith",
      "explanation": "A full name is a primary personal identifier. Missed by the deterministic engine.",
      "risk_level": "high",
      "recommendation": "redact",
      "detected_by": "llm",
      "applied_policy_rule": "1. Name"
    }
  ],
  "non_redacted": [
    {
      "value": "Email",
      "type": "GENERIC_LABEL",
      "explanation": "This is a generic field label, not PII itself.",
      "reason_kept": "Labels describe the type of data, not the data itself."
    }
  ],
  "overall_risk_summary": "The document contains multiple high-risk personal identifiers."
}
```

---

## 3. `POST /pii/upload`

Upload a text or PDF file for PII analysis. Runs the same full pipeline as `/pii/anonymize`.

### Request

**Content-Type:** `multipart/form-data`

| Field  | Type   | Required | Description                          |
|--------|--------|----------|--------------------------------------|
| `file` | File   | Yes      | A `.txt` or `.pdf` file to analyze   |
| `purpose` | Text | No       | The intended purpose (e.g. "Resume Review") |
| `policy_json`| Text| No | A stringified JSON representation of the PrivacyPolicy |

### Response `200 OK`

Same schema as [`POST /pii/anonymize`](#2-post-piianonymize).

### Error Responses

| Status | Detail                                      |
|--------|---------------------------------------------|
| `400`  | Could not extract text from the PDF.        |
| `400`  | File is not valid UTF-8 text.               |
| `400`  | Invalid policy JSON format.                 |
| `500`  | PDF support requires PyMuPDF.                |

---

## 4. `POST /pii/export`

Generate and download a redacted text file. Runs Layer 1 (Google Cloud Sensitive Data Protection) only — no LLM explanations.

### Request

**Content-Type:** `application/json`

```json
{
  "text": "string (required)"
}
```

### Response `200 OK`

**Content-Type:** `text/plain`
**Content-Disposition:** `attachment; filename=redacted_document.txt`

Returns a downloadable `.txt` file with all detected PII replaced by placeholder tags (e.g. `<EMAIL_ADDRESS>`, `<PERSON>`).

---

## 5. `POST /pii/export_pdf` (Phase 4)

Generate and download a redacted PDF file based on the user's final review decisions. The backend will physically apply black redaction rectangles over the specified text.

### Request

**Content-Type:** `multipart/form-data`

| Field             | Type   | Required | Description                                                                 |
|-------------------|--------|----------|-----------------------------------------------------------------------------|
| `file`            | File   | Yes      | The original `.pdf` file                                                    |
| `redactions_json` | Text   | Yes      | JSON string array: `[{"value": "John", "type": "PERSON", "action": "redact"}, ...]` <br> `action` can be `"redact"` (solid black box) or `"anonymize"` (white box with e.g. `<PERSON>` text). Defaults to `"redact"`. |

### Response `200 OK`

**Content-Type:** `application/pdf`
**Content-Disposition:** `attachment; filename=redacted_document.pdf`

Returns the newly redacted `.pdf` file.

---

## 6. `POST /pii/audit` (Phase 3)

Run an independent privacy audit on already redacted text to find any remaining direct or indirect identifiers.

### Request

**Content-Type:** `application/json`

```json
{
  "redacted_text": "string (required)",
  "policy": {
    "hide": ["string"],
    "keep": ["string"],
    "review": ["string"]
  } 
}
```

### Response `200 OK`

```json
{
  "status": "PASS | WARNING",
  "residual_risk": "LOW | MEDIUM | HIGH",
  "remaining_identifiers": [
    {
      "value": "string",
      "reason": "string",
      "recommendation": "string"
    }
  ],
  "result_summary": "string"
}
```



### PIIEntity

| Field           | Type    | Description                                                |
|-----------------|---------|------------------------------------------------------------|
| `type`          | string  | PII type (e.g. `PERSON`, `EMAIL_ADDRESS`, `CREDIT_CARD`)  |
| `start`         | int     | Start character index in original text                     |
| `end`           | int     | End character index in original text                       |
| `score`         | float   | Confidence score (0.0 – 1.0)                              |
| `value`         | string  | The actual text that was detected                          |
| `explanation`   | string  | Human-readable reason why this should be redacted          |
| `risk_level`    | string  | `high`, `medium`, or `low`                                 |
| `recommendation`| string  | `redact`, `review`, or `keep`                              |
| `detected_by`   | string  | `dlp` (Layer 1) or `llm` (Layer 2)                   |
| `applied_policy_rule` | string \| null | The specific rule from the Privacy Policy applied to this entity |

### NonRedactedItem

| Field         | Type   | Description                                        |
|---------------|--------|----------------------------------------------------|
| `value`       | string | The text that was NOT flagged as PII               |
| `type`        | string | What type of information it is                     |
| `explanation` | string | Why it was not flagged                             |
| `reason_kept` | string | Why it is safe to keep visible                     |

### PIIResponse

| Field                  | Type              | Description                                     |
|------------------------|-------------------|-------------------------------------------------|
| `original_text`        | string            | The original input text                         |
| `anonymized_text`      | string            | Text with all PII replaced by tags              |
| `entities`             | PIIEntity[]       | All detected PII entities with explanations     |
| `non_redacted`         | NonRedactedItem[] | Notable items kept visible, with reasons        |
| `overall_risk_summary` | string            | LLM-generated overall privacy risk assessment   |

---

## Common PII Types

| Type              | Example                    | Detected By       |
|-------------------|----------------------------|--------------------|
| `PERSON`          | John Smith                 | Google Cloud Sensitive Data Protection or LLM    |
| `EMAIL_ADDRESS`   | john@gmail.com             | Google Cloud Sensitive Data Protection           |
| `PHONE_NUMBER`    | 9876543210                 | Google Cloud Sensitive Data Protection           |
| `CREDIT_CARD`     | 4111-1111-1111-1111        | Google Cloud Sensitive Data Protection           |
| `EMPLOYEE_ID`     | EMP-4321                   | Google Cloud Sensitive Data Protection (custom)  |
| `ADDRESS`         | 123 Main St, Springfield   | LLM                |
| `DATE_OF_BIRTH`   | 15/03/1990                 | LLM                |
| `IP_ADDRESS`      | 192.168.1.1                | Google Cloud Sensitive Data Protection           |
| `IBAN_CODE`       | GB29 NWBK 6016 1331 9268 19| Google Cloud Sensitive Data Protection          |
| `US_SSN`          | 123-45-6789                | Google Cloud Sensitive Data Protection           |

---

## CORS

All origins are allowed. No authentication required.
