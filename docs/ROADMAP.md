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

# Phase 1.7 ✅

Underwriting Registry & Cross-Document Validation Audit

Completed.

Debt document architecture review

- Split `DEBT_ACCOUNT_STATEMENT` into a shared base (institution/balance/
  payment/rate/status) plus specialized `MORTGAGE_STATEMENT` and
  `HELOC_STATEMENT` kinds — the flat merge lost real fields (amortization
  remaining, maturity/renewal date, interest type, mortgage product, payout
  penalty) that only mortgages/HELOCs carry. Credit Card/Loan/Line of Credit
  stay merged under `DEBT_ACCOUNT_STATEMENT`; they share one shape with no
  analogous fields.

Cross-document validation

- Audited first: `reconcileTaxSlips()` (`src/utils/taxSlipParser.ts`) already
  reconciles the 5 legacy CRA tax-slip kinds, but only via a separate,
  manually-entered data model (`TaxSlipSuite.tsx`) disconnected from the
  Master Document Registry / AI ingestion path — it doesn't cover any of the
  Phase 1.6 document kinds.
- Added `src/utils/crossDocumentValidation.ts` — a standalone, provider-
  agnostic layer reconciling values across uploaded documents (borrower
  name, property address, corporate name consistency; income cross-checks;
  bureau vs. mortgage balance; APS vs. appraisal; gift vs. deposit; lease vs.
  T776; corporate directors vs. applicant identity).
- Wired into `src/hooks/useComplianceAlerts.ts` (already the hook
  `DossierGate` consumes) — no protected files modified.

Policy-hardcoding audit

- Reviewed every `validate()` for lender/insurer-specific thresholds
  asserted as fact; found and fixed one (Beacon-score alert asserting a
  "B/private lending stream" conclusion). Added a durable scope-boundary
  comment to `documentRegistry.ts` distinguishing objective facts and
  provider-agnostic heuristics (allowed) from lender/insurer policy
  (belongs in Phase 4, not the registry).

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

# Phase 3.5

File Reasoning Engine

Purpose

Reason across the entire mortgage file after all documents have been
extracted and individually validated — the layer above per-document
validation (documentRegistry.ts) and cross-document validation
(crossDocumentValidation.ts, Phase 1.7): synthesis, not just checking.

Deliverables

- File-level reasoning layer
- Cross-document evidence synthesis
- Explainable underwriting findings
- Missing evidence detection
- Contradictory evidence detection
- AI-generated underwriting summary
- AI-generated broker questions
- AI-generated submission readiness assessment
- Evidence graph linking related facts across documents
- Explainable reasoning for every generated finding

---

# Phase 4

Policy & Recommendation Engine

(Renamed from "Lender Policy Engine".) This is the intelligence behind
"Recommend Lenders" — and the designated home for anything the Phase 1.7
audit found that depends on a specific lender's/insurer's published
guideline rather than an objective fact or provider-agnostic heuristic
(see the scope-boundary comment in `documentRegistry.ts`).

Deliverables

- Lender policy database
- Mortgage product rules
- Insurer overlays (CMHC, Sagen, Canada Guaranty)
- Compensating factor framework
- Exception rules
- Rental income calculation policies
- Stress-test rules
- Broker overrides
- Explainable lender pass/fail decisions
- Lender recommendation ranking
- Product recommendation ranking
- Policy versioning and effective dates

---

# Phase 5

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

# Phase 6

Verification Improvements

- Better confidence scoring
- Manual review improvements
- Visual document comparison
- Field confidence
- Explainability

---

# Phase 7

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
- Auto conditions
- Smart resubmissions
