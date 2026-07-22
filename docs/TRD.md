# BrokerMindAI — Technical Requirements Document

Status: Draft, as of 2026-07-21. This document covers non-functional requirements, constraints,
and technical decisions. For the detailed pipeline/data-flow architecture, see
`docs/ARCHITECTURE.md` — this document does not repeat it, only references it. For decision
rationale, see `docs/DECISIONS.md`. For the full schema, see `docs/BACKEND_SCHEMA.md`.

---

## 1. Stack summary

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + TanStack Start (file-based routing) + Vite 8 |
| Styling | Tailwind CSS v4, shadcn/Radix UI primitives |
| Client state | Zustand (one store per domain — see `docs/ARCHITECTURE.md`/component inventory) |
| Server state / data fetching | TanStack Query |
| Backend | Supabase (Postgres, Auth, Edge Functions, Realtime, Storage) — **shared project with the Launchpad repo** (`kwdusucahpkfomjiyhie`) |
| AI / OCR | Anthropic Claude (AI), Google Document AI (OCR) — behind a provider abstraction, see `docs/ARCHITECTURE.md` §9 |
| Hosting | Vercel |
| PDF export | jsPDF (client-side dossier/audit-sheet/term-sheet generation) |
| Package manager | Bun |

## 2. Non-functional requirements

### 2.1 Security
- **No third-party API keys in the browser.** OCR/AI/Flinks/Plaid calls go through Supabase Edge
  Function proxies (`supabase/functions/*`) backed by Vault secrets. `src/lib/proxyClient.ts` is
  the only client-side entry point — direct provider calls from the browser are disallowed.
- **RLS is mandatory on every table.** No table ships without row-level security; see
  `docs/BACKEND_SCHEMA.md` for the full policy matrix. `anon` grants were fully revoked
  (migration `20260627095648`) — all app access requires an authenticated session.
- **Anti-spoofing on `user_id`.** Tables that record ownership use a `SECURITY DEFINER` trigger
  (`set_user_id_default()`) that forces `NEW.user_id := auth.uid()` server-side rather than
  trusting a client-supplied value.
- **Edge function rate limiting.** `_shared/proxy.ts`'s `guard()` applies a 100 calls/hour/user
  per-function limit (in-memory, per-instance — see §5 gaps).
- **Secrets never surface to settings UI.** `integrations.functions.ts` returns only a
  configured/not-configured status and a last-4 key preview, evaluated server-side.

### 2.2 Compliance & auditability
- **Immutable audit trail.** `audit_logs`, `file_notes`, and `document_extractions` are
  insert/select-only at the RLS level — no update/delete policy exists on any of them by design
  (`docs/DECISIONS.md` — "Immutable Processing Jobs").
- **FINTRAC/AML support.** Identity verification and source-of-funds tracking are first-class
  panels (`AmlPanel`, `SourceOfFundsPanel`), not bolted on.
- **Database-enforced business rule.** An incorporated applicant cannot move to
  `review_status = 'Ready for Review'` without a `T2` document on file — enforced by a Postgres
  trigger (`enforce_incorporated_requires_t2()`), not just client-side validation. This is the
  pattern to follow for future hard compliance rules: enforce at the database, not only in the UI.
- **Human-in-the-loop is architectural, not a UI convention.** AI output always lands in a
  verification step (`DocumentVerificationModal` / `verificationStore`) before it's treated as
  authoritative. No code path should let AI-extracted data reach `ingest()` unverified.

### 2.3 Provider independence
- No business logic may depend on a concrete OCR or AI provider. New providers implement the
  `OCRProvider`/`AIProvider` interfaces in `src/providers/{ocr,ai}/` and are selected via
  `VITE_OCR_PROVIDER`/`VITE_AI_PROVIDER` — see `docs/ARCHITECTURE.md` §9 for the full contract.
- Protected components (`documentRegistry.ts`, `verificationStore.ts`,
  `DocumentVerificationModal.tsx`, `DossierGate.tsx`) must have zero knowledge that OCR/AI
  providers exist.

### 2.4 Data integrity
- Every processing/extraction record is append-only; a replay creates a new row sharing the same
  `document_id` rather than overwriting (`docs/DECISIONS.md` — "Replay").
- Multi-tenant scoping: every workspace-relevant table carries `firm_id`, with RLS via
  `is_firm_member(firm_id)` — required for any new table holding firm data.

### 2.5 Performance (targets — not currently measured)
- No performance budget or monitoring is instrumented yet. `document_extractions` already
  records `latency_ms`, `input_tokens`, `output_tokens`, and `estimated_cost` per extraction —
  this is the intended source for a future latency/cost dashboard (Internal Tools, see
  `docs/IMPLEMENTATION_PLAN.md`), not yet surfaced anywhere.
- No explicit SLA/uptime target is defined (see `docs/PRD.md` §9 open questions).

### 2.6 Testing
- No automated test suite (unit/integration/e2e) was found in the repo at time of writing. This
  is a gap, not a decision — flagged in `docs/IMPLEMENTATION_PLAN.md`. Given the compliance
  surface area (T2 enforcement trigger, RLS policies, GDS/TDS/stress-test math), this is a
  higher-than-average risk gap for a financial application.

### 2.7 Environments & configuration
Client-exposed config (must be prefixed `VITE_`, safe to expose publicly):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_OCR_PROVIDER`, `VITE_AI_PROVIDER` (provider selection, defaults documented in
  `docs/ARCHITECTURE.md` §9)
- `VITE_INGESTION_MODE` (`pipeline` default, or `native` to skip the OCR provider entirely for AI
  providers with native document support — `docs/ARCHITECTURE.md` §9)

Server-only / Edge Function Vault secrets (never exposed to the client):
- `ANTHROPIC_API_KEY`, `GOOGLE_DOCUMENT_AI_KEY`, `GEMINI_API_KEY`, `FLINKS_CLIENT_ID`,
  `PLAID_SECRET` / `PLAID_CLIENT_ID`

Deployment: GitHub → Vercel, same pattern as the Launchpad repo but a separate Vercel project.
Database changes require a migration under `supabase/migrations/` — never a manual production
schema edit (`docs/DECISIONS.md`, `engineering-principles.md` in the Launchpad repo).

Edge Functions deploy separately from the Vercel app build: `.github/workflows/
deploy-supabase-functions.yml` runs `deno check` on every `supabase/functions/*/index.ts` then
`supabase functions deploy` on push to `main` (path-filtered to `supabase/functions/**` and
`supabase/config.toml`), or on manual dispatch. Requires a one-time repo secret,
`SUPABASE_ACCESS_TOKEN` (Settings → Secrets and variables → Actions), generated from
https://supabase.com/dashboard/account/tokens. This workflow deploys function *code* only —
provider secrets (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_DOCUMENT_AI_KEY`, etc.) are set
once via `supabase secrets set` and persist independently of code deploys; the workflow never
touches them.

## 3. Known technical debt / issues

| Issue | Detail | Status |
|---|---|---|
| ~~`renewals.balance` column mismatch~~ | `src/routes/lender.tsx` selected/read a `balance` column on `renewals` that no migration ever created — only `current_balance` exists (`RenewalPipelinePanel.tsx` already used the correct name). | **Fixed 2026-07-21** — `lender.tsx` now uses `current_balance` throughout (interface, `select()`, and all read sites). |
| Rate limiting is in-memory, per Edge Function instance | `_shared/proxy.ts`'s 100/hour limiter resets on cold start and doesn't share state across instances — not a durable rate limit under real load/scale-out. | Move to a durable store (Postgres table or Upstash Redis — already a dependency: `@upstash/redis`/`@upstash/ratelimit` are in `package.json` but not yet wired into the edge functions). |
| RBAC is a single boolean | `user_roles`/`useUserRole()` today only expose `isAdmin`. The four-tier model in `docs/ARCHITECTURE.md` §8 is designed but not implemented. | Tracked as Phase 2 in `docs/IMPLEMENTATION_PLAN.md`. |
| No automated tests | See §2.6. | Tracked as an implementation-plan item; prioritize RLS policies and the T2-enforcement trigger, GDS/TDS/stress-test math, and the ingestion pipeline's validator first. |
| `document_extractions` has no reader UI | Telemetry is written on every extraction but nothing in the app reads it back yet — by design (reserved for Internal Tools, `docs/ARCHITECTURE.md` §6), but worth confirming it's not simply forgotten as scope grows. | No action needed until Internal Tools phase begins. |

## 4. Constraints carried over from `docs/DECISIONS.md`

These are binding constraints for any future technical work, not suggestions:
1. Never couple the ingestion pipeline to a single AI/OCR provider.
2. Never let AI make a final lending decision — every decision path terminates in human review.
3. Customer-facing billing concepts are file-based, never AI-credit-based (internal cost tracking
   is separate and may reference tokens/provider cost).
4. Replay is always a new, auditable processing record — never an in-place update.
5. Developer Mode stays permanently available but must never be reachable by a non-admin/customer
   session.
6. Prefer small, independently verifiable changes over large rewrites; every phase should compile
   and be production-ready before the next begins.
