# BrokerMindAI — Project State

Last Updated: 2026-07-23

---

# Vision

BrokerMindAI is an AI-assisted mortgage underwriting platform.

The goal is not to replace underwriters.

The goal is to reduce manual document review while keeping humans in control of every funding decision.

---

# Current Status

## Phase 0 — Complete

Infrastructure

- GitHub connected
- Vercel deployment
- Shared Supabase project
- MailerLite integration
- Waitlist
- Landing page

Marketing

- Landing page
- Waitlist automation
- Welcome email

---

## Phase 1 — Complete

Document ingestion architecture.

Completed:

- Document Definition Registry
- Prompt Builder
- Response Validator
- Immutable document_extractions table
- AI ingestion pipeline
- Provider-independent architecture
- Removal of mock process-noa pipeline
- Removal of forensic-parse
- Documentation

---

## Phase 1.6 — Complete

Gemini AI provider integration (see "Current AI Status" below).

---

## Phase 1.7 — Complete

Underwriting Registry & Cross-Document Validation Audit.

Completed:

- Debt document architecture review: `MORTGAGE_STATEMENT`/`HELOC_STATEMENT` split out from
  `DEBT_ACCOUNT_STATEMENT` (real underwriting fields the flat merge lost)
- Cross-document validation layer (`src/utils/crossDocumentValidation.ts`), wired into
  `useComplianceAlerts.ts` — feeds `DossierGate` automatically
- Audited and confirmed: the pre-existing `reconcileTaxSlips()` tax-slip reconciliation
  (`src/utils/taxSlipParser.ts`) is disconnected from the Master Document Registry — still true,
  tracked as a known gap, not yet resolved
- Policy-hardcoding audit: registry now carries a scope-boundary comment distinguishing objective
  facts / provider-agnostic heuristics (allowed) from lender/insurer policy (deferred to the
  future Phase 4 Policy & Recommendation Engine)

---

## Phase 1.8 — Complete

Gemini OCR provider (see "Current AI Status" below) — lets pipeline mode run OCR via Gemini
instead of Google Document AI, so testing needs only `GEMINI_API_KEY`, not
`GOOGLE_DOCUMENT_AI_KEY`. Distinct from `VITE_INGESTION_MODE=native` (Phase 1.7): OCR and AI
stay two separate calls/prompts/telemetry rows even when both are Gemini.

---

# Current Architecture

```
PDF / Image
        ↓
OCR Provider
        ↓
AI Provider
        ↓
Structured JSON
        ↓
ingest()
        ↓
documentRegistry
        ↓
Verification Engine
        ↓
Verification Modal
        ↓
Compliance Engine
        ↓
DossierGate
```

Everything downstream of `ingest()` is considered production logic.

---

# Protected Components

These should not be modified unless absolutely necessary.

- documentRegistry.ts
- verificationStore.ts
- DocumentVerificationModal.tsx
- DossierGate.tsx

---

# Current Database

Implemented

- waitlist
- document_extractions

Future

- processing_jobs
- billing_usage
- subscriptions
- replay_history
- audit_events

---

# Current AI Status

Architecture completed. Provider abstraction (Phase 1.5), Gemini AI integration (Phase 1.6), and
Gemini OCR integration (Phase 1.8) complete.

Implemented providers

- OCR: Google Document AI (`ocr-proxy`, vault secret `GOOGLE_DOCUMENT_AI_KEY`) — default
  (`VITE_OCR_PROVIDER` unset or `google-document-ai`)
- OCR: Gemini (`gemini-proxy` with an OCR-only prompt, vault secret `GEMINI_API_KEY`) — swap via
  `VITE_OCR_PROVIDER=gemini`; lets pipeline mode run without a `GOOGLE_DOCUMENT_AI_KEY`
- AI: Claude (`ai-proxy`, vault secret `ANTHROPIC_API_KEY`)
- AI: Gemini (`gemini-proxy`, vault secret `GEMINI_API_KEY`, model `gemini-flash-latest`) —
  validates the full pipeline without Claude billing; swap via `VITE_AI_PROVIDER=gemini`

Recommended all-Gemini test configuration (no Google Document AI, no Claude billing):
`VITE_OCR_PROVIDER=gemini`, `VITE_AI_PROVIDER=gemini`, `VITE_INGESTION_MODE=pipeline` (or unset —
it's the default). OCR and AI remain two independent Gemini calls, not one merged call — that
merged single-call path is what `VITE_INGESTION_MODE=native` does instead (Phase 1.7).

Recognized, not yet implemented

- OCR: Azure Document Intelligence, AWS Textract, Tesseract, native PDF parser
- AI: OpenAI, Azure OpenAI, AWS Bedrock, Vertex AI

---

# Current Priorities

1. Authentication (RBAC hierarchy)
2. Firms
3. Billing
4. Processing Jobs
5. Replay
6. Audit Trail

---

# Development Principles

- Small incremental changes
- Build architecture before features
- Never rewrite working systems
- Verify after every phase
- Maintain provider independence