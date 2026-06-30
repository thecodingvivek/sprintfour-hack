### write up
For this hackathon, I chose Problem Statement 1 – Trust and Explainability.

Instead of focusing only on detecting personally identifiable information (PII), I focused on helping users understand why information was hidden or kept. The goal was to reduce the user's uncertainty before sharing sensitive documents with external AI tools.

The application starts by asking the user why they are sharing the document with AI (for example, resume review, contract analysis, or medical analysis). Based on this purpose, the system generates a privacy strategy that decides what information should generally be hidden, kept, or reviewed. The user can edit this strategy before analysis.

The uploaded PDF is then analyzed using Microsoft Presidio for deterministic PII detection and an LLM for contextual reasoning and explanations. Instead of presenting only extracted text, the application renders the original PDF with interactive highlights. Users can click any highlighted entity to see its confidence score, explanation, recommendation, and the reason behind the decision. After reviewing the document, users can download a permanently redacted PDF. For additional confidence, an optional Privacy Audit feature independently reviews the final document and reports any remaining potential identifiers before it is shared with an external AI.

### what I chose not to build

I intentionally did not build a custom PII detection model because the challenge explicitly states that detection is not the focus. Instead, I used existing tools so I could spend more time designing the user experience and explainability.

I also did not implement OCR for scanned PDFs, batch processing, authentication, collaboration features, or a fully local inference pipeline. These are valuable production features but were outside the scope of an MVP. My priority was to build a solution that directly addresses the trust concerns described in the problem statement while keeping the architecture simple, understandable, and extensible.