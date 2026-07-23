# BrokerMindAI — Implementation Plan

Status: Draft, as of 2026-07-21. This translates `docs/ROADMAP.md`'s phases into concrete,
actionable checklists, and folds in gaps found while writing `docs/TRD.md` and
`docs/BACKEND_SCHEMA.md`. Update this alongside `docs/PROJECT_STATE.md` as phases complete —
`PROJECT_STATE.md` stays the single "what's true right now" snapshot; this file is the working
checklist to get to the next snapshot.

**Every phase below is governed by `docs/ENGINEERING_STANDARDS.md` (mandatory, adopted
2026-07-22).** A phase's checkboxes above are not "done" at Build Complete — each phase's
completion must include an Infrastructure Audit and a Completion Checklist per that document
before it's reported as finished, not just implemented.

---

## Immediate (carried forward, not yet closed out)

Small, high-value fixes surfaced during earlier documentation/audit passes — not a new phase,
just cleanup that should land before more code builds on top of the current state.

- [x] Fix the `renewals.balance` vs `current_balance` mismatch (`docs/BACKEND_SCHEMA.md` §3,
      `docs/TRD.md` §3) — `src/routes/lender.tsx` now reads `current_balance` throughout,
      matching `RenewalPipelinePanel.tsx` and the actual schema.
- [ ] Decide and document a testing strategy (`docs/TRD.md` §2.6) — at minimum, cover the
      T2-required-for-incorporated trigger, RLS policies, and GDS/TDS/stress-test math, since
      these are compliance-load-bearing and currently unverified by anything but manual review.
- [ ] Confirm the in-memory Edge Function rate limiter (`_shared/proxy.ts`) is acceptable for
      current scale, or wire up the already-installed `@upstash/redis`/`@upstash/ratelimit`
      dependencies for a durable limiter (`docs/TRD.md` §3).

## Phase 1.6 — Gemini integration ✅

Goal: validate the full ingestion pipeline end-to-end without Claude API billing, using the
provider abstraction built in Phase 1.5.

- [x] Implement `GeminiProvider` in `src/providers/ai/geminiProvider.ts`, matching the
      `AIProvider` interface (`docs/ARCHITECTURE.md` §9) — including its own cost-estimate
      formula, calling `gemini-flash-latest` by default.
- [x] New `gemini-proxy` edge function (`GEMINI_API_KEY` vault secret), same request shape as
      `ai-proxy`.
- [x] Wired into `src/providers/ai/factory.ts` behind `VITE_AI_PROVIDER=gemini`.
- [x] No changes to `documentIngestPipeline.ts`, `responseValidator.ts`, `promptBuilder.ts`, or
      any protected verification component.
- [ ] End-to-end test against a real document upload with `VITE_AI_PROVIDER=gemini` and a live
      `GEMINI_API_KEY` — confirm telemetry lands in `document_extractions` with
      `llm_provider = 'gemini'`. Not yet run in this environment (no deployed Supabase project /
      live API key available here); do this before relying on Gemini in production.

## Phase 1.7 — Underwriting Registry & Cross-Document Validation Audit ✅

- [x] Debt document architecture review: split `DEBT_ACCOUNT_STATEMENT` into a shared base plus
      specialized `MORTGAGE_STATEMENT`/`HELOC_STATEMENT` kinds (real underwriting fields the flat
      merge lost); Credit Card/Loan/LOC stay merged (no fidelity loss there).
- [x] Cross-document validation audit: confirmed `reconcileTaxSlips()` already exists for the 5
      legacy tax-slip kinds but is disconnected from the Master Document Registry; built
      `src/utils/crossDocumentValidation.ts` to cover the Phase 1.6 document set, wired into
      `useComplianceAlerts.ts` (feeds `DossierGate` automatically, no protected files touched).
- [x] Policy-hardcoding audit: found and fixed one lender-stream assertion in
      `CREDIT_BUREAU_REPORT`; added a durable scope-boundary comment to `documentRegistry.ts`.
- [ ] Two example rules from the brief intentionally not implemented (documented as gaps, not
      silently skipped): down-payment shortfall (needs `applicationStore` loan terms, outside the
      document set) and per-tradeline HELOC-vs-bureau matching (needs itemized bureau tradeline
      data the current flat schema doesn't carry — `CREDIT_BUREAU_REPORT.mortgageBalanceReported`
      is a v1 aggregate proxy only).
- [ ] End-to-end test against real uploaded documents once live testing begins — cross-document
      rules are unit-clean (build/typecheck pass) but not yet exercised against real extractions.

## Phase 1.8 — Gemini OCR Provider ✅

- [x] Implement `GeminiOcrProvider` in `src/providers/ocr/geminiOcrProvider.ts`, matching the
      `OCRProvider` interface — calls `gemini-proxy` with a dedicated OCR-only system prompt
      (verbatim transcription, explicitly instructed not to interpret or extract fields), separate
      from `ai/geminiProvider.ts`'s prompt and response parsing.
- [x] Wired into `src/providers/ocr/factory.ts` behind `VITE_OCR_PROVIDER=gemini`.
- [x] No changes to `documentIngestPipeline.ts`, `responseValidator.ts`, `promptBuilder.ts`, the
      `gemini-proxy` edge function, or any protected verification component.
- [ ] End-to-end test with `VITE_OCR_PROVIDER=gemini` + `VITE_AI_PROVIDER=gemini` (pipeline mode,
      not native) against a real document upload — confirm `document_extractions.ocr_provider =
      'gemini'` and `llm_provider = 'gemini'` both land, and OCR/AI remain two distinct rows'
      worth of independent telemetry. Not yet run in this environment.

## Phase 2 — Authentication, Workspace, Developer Mode

Note: per `docs/ARCHITECTURE.md` §7, real auth infrastructure already exists (Supabase Auth
session, `AuthGate`, inactivity timeout, audit-logged login/logout, a boolean `isAdmin`). This
phase is about the *remaining* gaps, not starting from zero.

- [ ] **RBAC hierarchy** — extend `user_roles.role` from boolean-admin to the planned enum
      (`customer | processor | admin | super_admin`, `docs/ARCHITECTURE.md` §8). Extend
      `useUserRole()` additively (`{ role, isAdmin, isSuperAdmin, isProcessor, loading }`) so
      `AuditLogViewer`'s existing `isAdmin` check keeps working unchanged.
- [ ] **2FA** — not yet implemented; scope and add.
- [ ] **Firm invitations** — `firm_members` supports self-join today; add an actual invite flow
      (invite by email, accept/decline, ownership transfer).
- [ ] **Developer Mode formalization** — currently JSON upload exists in the ingestion pipeline
      (`ingestFromJson`) but isn't yet gated behind a dedicated admin-only Settings toggle per
      the design in `docs/DECISIONS.md`. Build that gate; confirm it's unreachable by non-admin
      sessions (test this explicitly, not just by code review).

## Phase 3 — Processing Jobs, Replay, Audit, Internal Tools

- [ ] **Processing Jobs table** — promote the current ad hoc extraction flow into a formal,
      immutable `processing_jobs` record per `docs/PROJECT_STATE.md`'s "Future" table list
      (distinct from `document_extractions`, which is telemetry — clarify the relationship
      before building, since there may be overlap worth consolidating rather than duplicating).
- [ ] **Replay** — implement as a new Processing Job sharing the original `document_id`, never
      an in-place update (`docs/DECISIONS.md` — "Replay").
- [ ] **Internal Tools route subtree** (`src/routes/internal/*`, reserved design in
      `docs/ARCHITECTURE.md` §6):
  - [ ] `SuperAdminGate` (composes `AuthGate` + role check)
  - [ ] JSON upload (promoted from its current temporary spot)
  - [ ] OCR/AI raw response viewers, reading `document_extractions`
  - [ ] Confidence heatmap, force reprocess, prompt-version comparison
  - [ ] AI latency / token usage / estimated cost dashboards — the data already exists in
        `document_extractions`, this is purely a reporting surface
  - [ ] Any new edge functions this introduces must independently verify the Super Admin role
        server-side (extend `_shared/proxy.ts`'s `guard()`), not rely on client-side gating alone

## Phase 3.5 — File Reasoning Engine

Reasons across the whole file after individual (`documentRegistry.ts`) and cross-document
(`crossDocumentValidation.ts`) validation have already run — synthesis, not checking.

- [ ] File-level reasoning layer + evidence graph linking related facts across documents
- [ ] Missing-evidence and contradictory-evidence detection
- [ ] AI-generated underwriting summary, broker questions, submission-readiness assessment
- [ ] Explainable reasoning attached to every generated finding

## Phase 4 — Policy & Recommendation Engine

(Renamed from "Lender Policy Engine".) The designated home for anything the Phase 1.7 audit
flagged as lender/insurer-specific rather than an objective fact or provider-agnostic heuristic —
see the scope-boundary comment in `documentRegistry.ts`. This becomes the intelligence behind
"Recommend Lenders."

- [ ] Lender policy database, mortgage product rules
- [ ] Insurer overlays (CMHC, Sagen, Canada Guaranty)
- [ ] Compensating factor framework, exception rules, broker overrides
- [ ] Rental income calculation policies, stress-test rules
- [ ] Explainable lender pass/fail decisions
- [ ] Lender + product recommendation ranking
- [ ] Policy versioning and effective dates

## Phase 5 — Billing

Per `docs/DECISIONS.md`: customers are billed per processed file, never by AI credit; internal
provider costs are tracked separately.

- [ ] `billing_usage` / `subscriptions` tables (`docs/PROJECT_STATE.md` "Future" list)
- [ ] Stripe integration
- [ ] Customer-facing usage surface: files processed, files remaining, monthly usage, next
      reset — explicitly never tokens/API-request counts (`docs/DECISIONS.md` — "Customer
      Experience")
- [ ] Replay billing: confirm replay consumes one file per the existing decision
- [ ] Internal profitability view: provider cost vs. customer plan price, using
      `document_extractions.estimated_cost`

## Phase 6 — Verification improvements

- [ ] Better confidence scoring (currently a flat `confidence` numeric on `parsed_documents`)
- [ ] Manual review UX improvements
- [ ] Visual document comparison (side-by-side source doc vs. extracted field)
- [ ] Per-field explainability (why did the AI extract this value)

## Phase 7 — Enterprise

- [ ] Public API + webhooks
- [ ] LOS/CRM integrations
- [ ] SSO
- [ ] Team management beyond the Phase 2 RBAC baseline

## Cross-cutting, ongoing

These aren't a phase — they're standing requirements that every phase above should be checked
against before merging (see `docs/DECISIONS.md` and `docs/TRD.md` §4):

- [ ] Every new provider-facing feature stays behind the `OCRProvider`/`AIProvider` abstraction —
      no direct provider calls from client or business logic.
- [ ] Every new table holding firm data carries `firm_id` and the matching `is_firm_member` RLS
      policy.
- [ ] Every schema change ships as a migration under `supabase/migrations/` — never a manual
      production edit.
- [ ] Every AI-derived value that could affect a lending decision passes through a human
      verification step before being treated as authoritative.
- [ ] Every phase's infrastructure footprint (Edge Functions, migrations, secrets, env vars,
      storage, CORS/auth config) is audited and actually deployed/verified before the phase is
      reported complete — per `docs/ENGINEERING_STANDARDS.md` §4–§6. A green build is not this.
- [ ] Update `docs/PROJECT_STATE.md` and this file's checkboxes at the end of each completed
      phase — stale status docs are worse than no status docs.
