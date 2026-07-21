# BrokerMindAI — Product Requirements Document

Status: Draft, derived from the shipped product as of 2026-07-21. See `docs/ROADMAP.md` for
phase status and `docs/PROJECT_STATE.md` for the latest snapshot — this document should be
kept in sync with both as scope changes.

---

## 1. Problem

Canadian mortgage brokers, agents, underwriters, and private/alternative lenders spend a large
share of every file manually re-keying figures from tax slips (T1/T2/T4/T4A/T5/T2125/NOA),
cross-checking them against loan applications, running FINTRAC/AML and compliance checks by
hand, and tracking conditions, rate holds, and renewals across spreadsheets and email. This is
slow, error-prone, and doesn't scale with file volume.

## 2. Product

BrokerMindAI is an AI-assisted mortgage underwriting workspace. It ingests tax and income
documents, extracts structured data via an OCR + LLM pipeline, reconciles it against the loan
application, surfaces compliance and risk flags, and gives a broker a single dossier per
applicant that tracks the file from intake through funding — while keeping a human in control
of every decision (see `docs/DECISIONS.md` — "Human-in-the-Loop").

**BrokerMindAI is not:**
- A Loan Origination System (LOS) replacement
- A CRM replacement
- A consumer-facing mortgage application portal
- A document storage platform

It integrates with a broker's existing workflow rather than replacing it.

## 3. Target users / personas

| Persona | Represents | Primary need |
|---|---|---|
| Mortgage Broker / Agent | Individual producer, day-to-day user | Fast, accurate file intake and a clear risk/compliance picture per applicant |
| Brokerage Owner / Principal Broker | Firm admin | Visibility across the whole book, team management, branding |
| Underwriter / Fulfillment Specialist | Reviews files before submission | Reliable extraction, audit trail, conditions tracking |
| Private / Alternative Lender, MIC rep | Portfolio-level view | Portfolio concentration, LTV, maturity schedule, risk exposure across the whole book |
| Business Development Manager (BDM) | Lender-side relationship contact | Term sheet generation, lender suitability matching |

(Future expansion per `docs/vision.md` in the Launchpad repo: banks, credit unions, Australian/UK
mortgage markets, commercial lending — out of scope for current implementation.)

## 4. Goals

1. Cut manual tax-document review time per file by extracting structured data automatically
   (OCR → LLM → validated JSON) instead of manual re-keying.
2. Catch compliance and reconciliation issues (FINTRAC/AML, income mismatches, arrears, T2
   add-backs) before a file reaches a lender.
3. Give every user a single workspace per applicant (the "Dossier") that stays consistent from
   intake to funded, with an immutable audit trail.
4. Support firm-level (multi-user) workspaces, not just individual brokers.
5. Stay provider-independent for OCR/AI so the underlying models can change without rewriting
   business logic (`docs/DECISIONS.md` — "Provider Independence").

## 5. Non-goals (current phase)

- Full LOS functionality (e-signature, direct lender submission APIs, closing/funding wire
  automation)
- Consumer/borrower-facing portal
- Automated AI-only lending decisions (explicitly excluded — human-in-the-loop is a permanent
  architectural decision, not a phase-1 limitation)
- Multi-region/multi-currency support

## 6. Core features (shipped)

Grouped by the routes/components that implement them — see `docs/APP_FLOW.md` for flow detail
and `docs/UI_UX_DESIGN.md` for the UI inventory.

### 6.1 Underwriting workspace (`/`)
The core "Dossier" workbench for a single applicant: loan terms, REO matrix, employment intake,
co-applicant module, subject property, tax-slip reconciliation (T1/T2/T4/T4A/T5/T2125), income
adjustments, credit profile, stress test (OSFI B-20), CMHC eligibility, rental-income offset,
lender suitability/guideline library, exit strategy (private/MIC), prepayment privileges,
conditions board, rate holds, communications log, file notes, and a gated dossier/term-sheet
export.

### 6.2 Document AI ingestion
Upload a PDF/image (or a JSON test file in Developer Mode) → OCR provider → AI provider →
validated structured JSON → the verification engine. See `docs/ARCHITECTURE.md` §2–§10 for the
full pipeline and provider abstraction design.

### 6.3 Compliance & risk engine
FINTRAC/AML identity verification, source-of-funds tracking, GDS/TDS and stress-test
calculation, T2-incorporated-applicant validation (enforced at the database level — see
`docs/BACKEND_SCHEMA.md`), and a compliance alert feed with severity levels and realtime updates.

### 6.4 Firm-level pipeline & dashboard
`/dashboard` (book summary), `/pipeline` (kanban + table deal tracker with saved filters),
`/compliance` (firm-wide alert feed), `/lender` (private-lender portfolio metrics: book value,
average LTV/rate, provincial concentration, maturity schedule).

### 6.5 Renewals & rate holds
`/renewals` and the in-workspace rate-hold panel track upcoming maturities and active rate
holds with urgency coding and AI-assisted outreach drafting.

### 6.6 Firm administration
`/settings`: firm profile, white-label branding (logo/colors), third-party integration status
(Mindee/Flinks/Plaid — keys never reach the browser or DB), team/role management, per-firm
lender policy library, user preferences, and a full audit-log viewer.

### 6.7 Authentication & workspace
Supabase Auth (login/signup/forgot/reset password), session inactivity timeout, audit-logged
login/logout, firm membership (`firms`/`firm_members`), and a first-run onboarding wizard.

## 7. User stories

- As a mortgage broker, I upload a client's NOA and T4s and get structured, validated figures
  back without re-typing them, so I can spend my time on the file's actual risk profile.
- As an underwriter, I see every compliance flag (income mismatch, arrears, missing T2 for an
  incorporated applicant) surfaced automatically before I submit to a lender.
- As a brokerage owner, I see my whole team's pipeline in one dashboard — files needing
  attention, rate holds expiring soon, upcoming renewals — without asking each agent for status.
- As a private lender / MIC rep, I see portfolio-level exposure (LTV distribution, provincial
  concentration, maturity schedule) across every file in my book.
- As a compliance officer, every extraction, override, and verification is in an immutable audit
  log I can export.
- As a developer/admin, I can test the full verification/compliance UI with JSON fixtures
  without spending on AI API calls (Developer Mode — see `docs/DECISIONS.md`).

## 8. Success metrics (proposed — not yet instrumented)

| Metric | Why it matters |
|---|---|
| Time from document upload to validated structured data | Core value prop: manual re-keying eliminated |
| % of extractions requiring manual field correction | Extraction/verification quality |
| Compliance flags caught pre-submission vs. post-submission rejections | Risk-reduction value |
| Files processed per broker per week | Throughput/productivity gain |
| Firm activation → first funded file (time-to-value) | Onboarding effectiveness |

No analytics/telemetry currently reports these — `document_extractions` (per
`docs/BACKEND_SCHEMA.md`) captures the raw data needed for the first two once a reporting
surface exists (see Phase 3/Internal Tools in `docs/IMPLEMENTATION_PLAN.md`).

## 9. Open questions

- Pricing model is decided in principle (per-file, never per-AI-credit — see `docs/DECISIONS.md`
  "Billing Model") but plans/pricing tiers are not yet defined.
- RBAC is currently a single boolean (`isAdmin`); the planned four-tier role model
  (Customer/Processor/Admin/Super Admin, `docs/ARCHITECTURE.md` §8) is not yet implemented.
- No formal SLA/uptime target has been set.
