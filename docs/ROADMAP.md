# BrokerMindAI Roadmap

---

# Phase 0 ✅

Infrastructure

- Landing page
- Waitlist
- MailerLite
- Deployment
- Supabase

Completed.

---

# Phase 1 ✅

Document Ingestion Architecture

Completed.

- Document Registry
- Prompt Builder
- Response Validator
- AI Pipeline
- Immutable extraction records
- Documentation

---

# Phase 1.5 ✅

Provider Abstraction

Completed.

- OCRProvider interface
- AIProvider interface
- Provider Factory
- Shared request models
- Shared response models
- Provider configuration (VITE_OCR_PROVIDER / VITE_AI_PROVIDER)

No provider-specific code in the ingestion pipeline. Only Google Document AI
(OCR) and Claude (AI) are implemented — matching what Phase 1 already called —
wrapped behind the new interfaces. Every other provider below is a recognized,
selectable identifier with no implementation yet, not new integration work.

See docs/ARCHITECTURE.md §9 for the full design.

---

# Phase 1.6 ✅

Gemini Integration

Temporary provider.

Implemented

- `GeminiProvider` (`src/providers/ai/geminiProvider.ts`), calling `gemini-2.5-flash`
- New `gemini-proxy` edge function (vault secret `GEMINI_API_KEY`)
- Registered in `ProviderFactory` — `VITE_AI_PROVIDER=gemini` is a drop-in swap for `claude`
- Structured JSON extraction via the existing `responseValidator.ts`, unchanged

Purpose

Validate the complete ingestion pipeline end-to-end without Claude API billing.

---

# Phase 2

Authentication

- Login
- Registration
- Email verification
- Password reset
- Session management

Workspace

- Firms
- Invitations
- Roles
- Ownership

Developer Mode

- Admin only
- JSON upload
- Debug tools
- Hidden from customers

---

# Phase 3

Processing Jobs

Every processing request becomes a Processing Job.

Track

- OCR duration
- AI duration
- Replay
- Status
- Errors
- Timeline

Replay becomes a new Processing Job.

---

# Phase 4

Billing

Customer sees

- Files processed
- Files remaining
- Monthly usage
- Next reset

Internal

- Provider costs
- Token usage
- Processing cost
- Profitability

---

# Phase 5

Verification Improvements

- Better confidence scoring
- Manual review improvements
- Visual document comparison
- Field confidence
- Explainability

---

# Phase 6

Enterprise

- API
- Webhooks
- CRM integrations
- LOS integrations
- SSO
- Team management

---

# Future Ideas

- Multi-document processing
- Batch uploads
- Live processing queue
- AI model comparison
- Fraud detection
- Income trend analysis
- Smart lender recommendations
- Auto conditions
- Smart resubmissions
