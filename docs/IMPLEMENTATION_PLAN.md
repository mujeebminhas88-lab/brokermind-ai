# BrokerMindAI — Implementation Plan

Status: Draft, as of 2026-07-21. This translates `docs/ROADMAP.md`'s phases into concrete,
actionable checklists, and folds in gaps found while writing `docs/TRD.md` and
`docs/BACKEND_SCHEMA.md`. Update this alongside `docs/PROJECT_STATE.md` as phases complete —
`PROJECT_STATE.md` stays the single "what's true right now" snapshot; this file is the working
checklist to get to the next snapshot.

---

## Immediate (before Phase 1.6 begins)

Small, high-value fixes surfaced during this documentation pass — not a new phase, just cleanup
that should land before more code builds on top of the current state.

- [x] Fix the `renewals.balance` vs `current_balance` mismatch (`docs/BACKEND_SCHEMA.md` §3,
      `docs/TRD.md` §3) — `src/routes/lender.tsx` now reads `current_balance` throughout,
      matching `RenewalPipelinePanel.tsx` and the actual schema.
- [ ] Decide and document a testing strategy (`docs/TRD.md` §2.6) — at minimum, cover the
      T2-required-for-incorporated trigger, RLS policies, and GDS/TDS/stress-test math, since
      these are compliance-load-bearing and currently unverified by anything but manual review.
- [ ] Confirm the in-memory Edge Function rate limiter (`_shared/proxy.ts`) is acceptable for
      current scale, or wire up the already-installed `@upstash/redis`/`@upstash/ratelimit`
      dependencies for a durable limiter (`docs/TRD.md` §3).

## Phase 1.6 — Gemini integration (next up per `docs/ROADMAP.md`)

Goal: validate the full ingestion pipeline end-to-end without Claude API billing, using the
provider abstraction built in Phase 1.5.

- [ ] Implement `GeminiProvider` in `src/providers/ai/`, matching the `AIProvider` interface
      (`docs/ARCHITECTURE.md` §9) — including Gemini's own cost-estimate formula.
- [ ] Wire it into `src/providers/ai/factory.ts` behind `VITE_AI_PROVIDER=gemini`.
- [ ] No changes to `documentIngestPipeline.ts`, `responseValidator.ts`, `promptBuilder.ts`, or
      any protected verification component — if any of those need to change, the abstraction
      boundary has a leak and that's a bug, not a feature requirement.
- [ ] End-to-end test: real document upload → Gemini OCR/extraction → verification →
      compliance → dossier, confirming telemetry lands correctly in `document_extractions` with
      `llm_provider = 'gemini'`.

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

## Phase 4 — Billing

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

## Phase 5 — Verification improvements

- [ ] Better confidence scoring (currently a flat `confidence` numeric on `parsed_documents`)
- [ ] Manual review UX improvements
- [ ] Visual document comparison (side-by-side source doc vs. extracted field)
- [ ] Per-field explainability (why did the AI extract this value)

## Phase 6 — Enterprise

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
- [ ] Update `docs/PROJECT_STATE.md` and this file's checkboxes at the end of each completed
      phase — stale status docs are worse than no status docs.
