# BrokerMindAI — ChatGPT Session Summary
**Date:** 2026-07-20

---

# Current Project Status

## Phase 0 — Completed ✅

### Landing Page
- Waitlist fully functional.
- Duplicate email detection works.
- MailerLite integration working.
- Welcome automation working.
- Vercel deployment working.
- Supabase integration working.
- Diagnostics removed after verification.

### MailerLite
Implemented:

- Server-side API integration
- Automatic group creation
- Subscriber upsert
- Automation trigger
- Graceful failure handling

Issue discovered:

The automation originally wasn't firing because subscribers were being created as **Unconfirmed** rather than **Active**.

Once subscribers were created as **Active**, MailerLite automation triggered immediately.

No further work required.

---

# Current Architecture

Current ingestion pipeline:

PDF / Image
↓
OCR Provider
↓
LLM Provider
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

The downstream verification engine is now considered **protected**.

Protected files:

- documentRegistry.ts
- verificationStore.ts
- DocumentVerificationModal.tsx
- DossierGate.tsx

These should not be modified unless absolutely necessary.

---

# Phase 1

Completed:

- Document Definition Registry
- Prompt Builder
- Response Validator
- document_extractions table
- Immutable extraction records
- AI ingestion pipeline
- Removed process-noa
- Removed mock NOA pipeline
- Removed forensic-parse
- Documentation
- Architecture
- Roadmap

Later fixes:

- HEIC MIME fallback
- Unexpected field telemetry
- Additional validation
- Production review

---

# Major Architectural Decision

Do NOT couple BrokerMindAI to a single AI provider.

Instead:

```
OCR Provider
        ↓
AI Provider
        ↓
Structured JSON
```

Everything downstream stays identical.

---

# Multi Provider Goal

Future OCR providers:

- Google Document AI
- Azure Document Intelligence
- AWS Textract
- Tesseract
- Native PDF parser

Future AI providers:

- Gemini
- Claude
- OpenAI
- Azure OpenAI
- AWS Bedrock
- Vertex AI

Switching providers should require only configuration, not code changes.

---

# Immediate Next Step

## Phase 1.5

Do NOT integrate Gemini yet.

Instead build the abstraction layer.

Claude implementation:

- AIProvider interface
- OCRProvider interface
- ProviderFactory
- Shared request models
- Shared response models
- Provider configuration
- Documentation

No provider implementation yet.

Goal:

Future integrations become plug-and-play.

---

# Phase 1.6

Implement the first provider:

Gemini

Reason:

- Already available.
- No Claude API billing required.
- Allows complete end-to-end testing.

The provider abstraction built in Phase 1.5 should allow Gemini to plug in without changing the ingestion pipeline.

Later:

Gemini can simply be replaced with Claude by changing configuration.

---

# Developer Mode

Decision:

Developer Mode should remain permanently.

Reason:

Developers need to test:

- Validation
- Verification
- DossierGate
- UI
- Compliance engine

without consuming AI requests.

However:

Developer Mode must NEVER be visible to customers.

Future design:

Settings
→ Developer Mode

Only available for authenticated admins.

Developer Mode enables:

- JSON upload
- Replay testing
- Raw AI response viewer
- Raw OCR viewer
- Extraction telemetry
- Debug information

Normal users never see these options.

---

# Authentication Phase

Future implementation:

- Login
- Registration
- Password reset
- Email verification
- Session persistence
- Protected routes

Workspace support:

- Firms
- Invitations
- Member roles
- Ownership transfer
- Workspace settings

Roles:

- Owner
- Admin
- Underwriter
- Reviewer
- Read Only

---

# Billing Decision

Customers never see AI credits.

Customers only see:

- Files processed
- Remaining files
- Monthly usage
- Next reset date

Replay counts as a new processed file.

Internally store immutable Processing Jobs containing:

- provider
- OCR duration
- AI duration
- provider cost
- replay flag
- timestamps
- status

This allows changing AI providers without changing customer billing.

---

# Future Dashboard

Dashboard will include:

- Files processed
- Remaining files
- Replay history
- Processing history
- Failed jobs
- OCR duration
- AI duration
- Monthly usage
- Upgrade plan

---

# Audit Trail

Track:

- Every extraction
- Every replay
- Every manual override
- Every export
- Every verification

Append-only.

Never editable.

---

# Remaining Roadmap

## Phase 1.5

Provider abstraction.

No provider implementation.

---

## Phase 1.6

Gemini integration.

---

## Phase 2

Authentication

Workspace/Firms

Invitations

Roles

Developer Mode

---

## Phase 3

Processing Jobs

Replay

History

Audit Trail

Telemetry

---

## Phase 4

Billing

Stripe

Usage

Plans

Replay billing

---

## Phase 5

Human Verification improvements

Confidence visualization

Manual review improvements

Audit exports

---

## Phase 6

Enterprise

API

Webhooks

LOS integrations

CRM integrations

SSO

---

# Important Principles

1. Protect the verification engine.

2. Never couple to one AI provider.

3. Customer billing is file-based, never AI-credit-based.

4. Replay is always a new processing job.

5. Every processing job is immutable.

6. Developer Mode remains available forever but hidden behind admin authentication.

7. Build incrementally.

8. Review every phase before starting the next.

9. Prefer architecture before implementation.

10. Keep BrokerMindAI provider-agnostic for the long term.