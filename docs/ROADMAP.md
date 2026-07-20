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

# Phase 1.5

Provider Abstraction

Goals

- OCRProvider interface
- AIProvider interface
- Provider Factory
- Shared request models
- Shared response models
- Provider configuration

No provider-specific code.

---

# Phase 1.6

Gemini Integration

Temporary provider.

Implement

- Gemini Provider
- OCR integration
- Structured JSON extraction

Purpose

Validate the complete ingestion pipeline before Claude.

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
