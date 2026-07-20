# BrokerMindAI — Project State

Last Updated: 2026-07-20

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

Architecture completed.

Provider abstraction beginning.

No production OCR provider connected yet.

No production LLM connected yet.

Temporary development provider will be Gemini.

Future providers include:

- Claude
- Gemini
- OpenAI
- Azure OpenAI
- AWS Bedrock
- Vertex AI

---

# Current Priorities

1. Provider abstraction
2. Gemini integration
3. Authentication
4. Firms
5. Billing
6. Processing Jobs
7. Replay
8. Audit Trail

---

# Development Principles

- Small incremental changes
- Build architecture before features
- Never rewrite working systems
- Verify after every phase
- Maintain provider independence