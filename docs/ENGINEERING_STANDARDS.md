# BrokerMindAI — Engineering Standards

Status: **Mandatory.** Adopted 2026-07-22. This document is permanent architecture
documentation, on the same footing as `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`. Every
future implementation — by a human or by an AI session working on this repo — follows this
standard. It is not a suggestion.

## Why this document exists

We shipped a feature where the code compiled, GitHub was up to date, and Vercel deployed
successfully — and the feature still didn't work in production, because the Supabase Edge
Functions it depended on had never actually been deployed. The failure was invisible to every
signal we were checking: green build, green git status, green Vercel deploy. It only surfaced
when a real user hit a real CORS error in the browser.

The root cause wasn't a coding mistake. It was a **process gap**: nothing in our workflow
distinguished "the code is correct" from "the system this code depends on is actually configured
and running in production." This document closes that gap by naming the stages explicitly and
requiring proof, not assumption, at each one.

---

## 1. The six-stage lifecycle

A BrokerMindAI feature moves through six stages. Each stage is a distinct claim; passing one
does not imply the next. **A feature is not complete until all six have passed — in this repo,
"done" means Production Verified, nothing short of it.**

| Stage | Claim being made | Proof required |
|---|---|---|
| **Architecture Complete** | The design is decided and consistent with existing principles (§2) — which files change, which are protected (§3), what (if anything) crosses the OCR/AI/validation/verification/policy boundaries. | A stated design, reviewed against §2/§3 — not yet code. |
| **Implementation Complete** | The code exists and follows the established patterns (registry/prompt/validator, provider abstraction, extension-over-modification). | Diff exists; protected-file changes are individually justified (§3). |
| **Build Complete** | The code compiles and type-checks. | `bun run build` and `bunx tsc --noEmit` both exit 0. **This is the stage our process gap treated as "done." It is one of six.** |
| **Infrastructure Complete** | Every piece of infrastructure this feature touches (§4) has actually been changed to match the code — not just identified, but done. | Migration applied, function deployed, secret set, bucket/policy created — whichever apply, all of them, verified individually. |
| **Deployment Complete** | The updated code and updated infrastructure are both live in the same production environment at the same time. | Vercel deployment live at the current commit; `supabase functions list` shows the current version; migrations applied to the production database. |
| **Production Verified** | The feature was exercised through the real production stack — real browser, real network calls, real provider responses — and it worked. | A walked end-to-end trace (§5) with each stage's actual result recorded, not assumed. |

A green build is Stage 3 of 6. It proves the code is internally consistent; it proves nothing
about Supabase, Vercel env vars, secrets, or whether anyone deployed anything. Treat "build
passed" and "feature works in production" as two separate, unrelated facts until stage 6 has
been walked.

---

## 2. Architecture First

These principles are not new — they're already load-bearing in `docs/DECISIONS.md` and
`docs/ARCHITECTURE.md`. This section exists so the lifecycle in §1 has something concrete to
check "Architecture Complete" against, not to restate them for their own sake.

- **Architecture before implementation.** Small, incremental, independently-verifiable changes;
  every phase compiles and is production-ready before the next begins (`docs/DECISIONS.md` —
  "Small Incremental Development").
- **Preserve provider abstraction.** No business logic depends on a concrete OCR or AI provider.
  New providers implement `OCRProvider`/`AIProvider` (`src/providers/{ocr,ai}/`) and are selected
  via `VITE_OCR_PROVIDER`/`VITE_AI_PROVIDER` — see `docs/ARCHITECTURE.md` §9.
- **Preserve immutable extraction records.** `document_extractions` (and any future processing/
  audit record) is append-only; a replay is a new row sharing the same `document_id`, never an
  in-place update (`docs/DECISIONS.md` — "Immutable Processing Jobs", "Replay").
- **Preserve verification engine boundaries.** AI-extracted data is never treated as
  authoritative until it passes through `DocumentVerificationModal`/`verificationStore`'s
  human-in-the-loop lifecycle. This is architectural, not a UI convention
  (`docs/DECISIONS.md` — "Human-in-the-Loop").
- **Prefer extension over modification.** Adding a document kind means appending a
  `DocumentRegistry` entry, not restructuring `processDocument()`/`aggregateCompliance()`. Adding
  a provider means a new file behind the existing interface, not a new branch in the pipeline.
  Adding a cross-document rule means appending to `CROSS_DOCUMENT_RULES`/`FACT_GROUPS`
  (`src/utils/crossDocumentValidation.ts`), never touching an existing `DocumentRegistry` entry's
  own `validate()`.
- **Keep OCR, AI, validation, verification, and policy layers independent.** Concretely, today:
  OCR (`src/providers/ocr/`) → AI (`src/providers/ai/`) → single-document validation
  (`src/utils/documentRegistry.ts`) → cross-document validation
  (`src/utils/crossDocumentValidation.ts`) → verification engine (`verificationStore.ts`,
  `DocumentVerificationModal.tsx`, `DossierGate.tsx`) → policy/lender rules (Phase 4, not yet
  built — see `docs/ROADMAP.md`). A change to one layer should never require touching another to
  compile. If it does, the boundary has a leak — treat that as a bug in the change, not a
  necessary side effect.

---

## 3. Protected Files

Per `docs/PROJECT_STATE.md` — "Protected Components":

- `src/utils/documentRegistry.ts`
- `src/store/verificationStore.ts`
- `src/components/DocumentVerificationModal.tsx`
- `src/components/DossierGate.tsx`

**These may only be modified when absolutely necessary, and every modification must be
explicitly justified in the implementation's completion report (§6).**

Nuance worth stating precisely, since "protected" is not the same as "frozen": `documentRegistry.ts`
has a designed, sanctioned extension point — appending a new `DocumentRegistry` entry (fields,
`extract()`, `validate()`) is the intended way to grow the registry and does not require special
justification beyond normal code review; that is what the file's own header comment describes.
What *does* require explicit justification is touching `processDocument()`, `aggregateCompliance()`,
`runSuperPriorityChecks()`, the `RegistryEntry`/`ExtractedFields`/`ComplianceAlert` shapes, or
anything in the other three protected files. Phase 1.6/1.7 are the precedent: both added
substantial registry content without touching the protected engine functions or the other three
files at all — that's the bar.

If a change to a protected file is genuinely necessary, the completion report must state: which
file, which specific function/section, why the change couldn't be achieved by extension, and
what was verified to confirm nothing downstream broke.

---

## 4. Infrastructure Audit (Mandatory)

Before writing code for any feature, determine whether it affects any of the following. This is
a checklist to run through explicitly, not a judgment call to skip because a change "seems
frontend-only" — the incident that produced this document looked frontend-only too.

- [ ] **Supabase Edge Functions** (`supabase/functions/*`) — new function, changed request/
      response shape, changed required secrets, changed `verify_jwt`/CORS config.
- [ ] **Database schema** — new/changed table, column, enum, or constraint.
- [ ] **Database migrations** (`supabase/migrations/*.sql`) — every schema change ships as one;
      never a manual production edit (`docs/DECISIONS.md`, launchpad
      `engineering-principles.md`).
- [ ] **RLS policies** — every new table needs one; every firm-scoped table needs the
      `is_firm_member(firm_id)` pattern (`docs/BACKEND_SCHEMA.md` §4).
- [ ] **Storage buckets** — e.g. `brokerage-logos`. New bucket, new folder convention, new file
      type.
- [ ] **Storage policies** — access scoped correctly (today: per-`auth.uid()` folder prefix).
- [ ] **Vault Secrets** — `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_DOCUMENT_AI_KEY`,
      `FLINKS_CLIENT_ID`, `PLAID_SECRET`/`PLAID_CLIENT_ID`, or any new one a feature introduces.
- [ ] **Environment Variables** — client (`VITE_*`, Vercel) vs. server-only (Supabase Edge
      Function secrets) — see `docs/TRD.md` §2.7. Getting this distinction wrong is exactly how a
      variable silently never reaches the code that needs it (`docs/ARCHITECTURE.md` §9's
      `VITE_` prefix note).
- [ ] **Scheduled jobs** — none exist today; if a feature introduces one, it belongs in this
      checklist from day one, not discovered later.
- [ ] **Auth configuration** — Supabase Auth settings (session length, redirect URLs, providers).
- [ ] **CORS configuration** — `ALLOWED_ORIGINS` (`_shared/proxy.ts`) and each function's
      `verify_jwt` setting in `supabase/config.toml`. **This is the exact class of bug that
      produced this document** — `verify_jwt` defaulting to `true` with no config override
      rejects the CORS preflight before the function's own code ever runs, and looks
      indistinguishable in the browser from "function not deployed."
- [ ] **External APIs** — Anthropic, Google Document AI, Gemini, Flinks, Plaid, or any new
      provider.
- [ ] **Provider configuration** — `VITE_OCR_PROVIDER`/`VITE_AI_PROVIDER` and the corresponding
      factory registration (`src/providers/{ocr,ai}/factory.ts`).
- [ ] **Vercel configuration** — `vercel.json`, environment variables, build settings.

**If any box is checked, implementation is not complete until that infrastructure change has
actually been made and independently verified — not merely identified.** "I noted that this
needs a migration" is Architecture Complete language. "The migration is applied and I confirmed
the column exists" is Infrastructure Complete language. Only the second counts.

---

## 5. Deployment Requirements

Every implementation states explicitly whether deployment is required, and for which systems.
"No deployment needed" is a valid conclusion — but it must be a stated conclusion, not a default
assumption.

**Edge Functions**
- [ ] Deploy the function (`.github/workflows/deploy-supabase-functions.yml` on push to `main`
      touching `supabase/functions/**`/`config.toml`, or `workflow_dispatch` — see
      `docs/TRD.md` §2.7).
- [ ] Verify deployment succeeded — `supabase functions list` shows `ACTIVE` at the expected
      version, or the deploy workflow's own log line (`Deployed Functions on project ...:
      <names>`). Do not infer success from the workflow simply not having errored on an
      unrelated earlier step.

**Database**
- [ ] Generate the migration under `supabase/migrations/`.
- [ ] Apply the migration to production.
- [ ] Verify the schema — the column/table/constraint actually exists in the live database, not
      only in the migration file.

**Secrets**
- [ ] Verify required secrets exist (`supabase secrets list` — names only, never values).
- [ ] Document any missing secret explicitly, by name, in the completion report.
- [ ] **Never assume a production secret exists because a local `.env` or a doc mentions it.**
      This is the single largest contributor to the incident this document exists to prevent —
      a secret referenced in code and in documentation is not the same fact as a secret present
      in the live Vault.

**Environment Variables**
- [ ] Document every required variable a feature introduces or depends on.
- [ ] Verify naming consistency end-to-end — a client var must be `VITE_`-prefixed to ever reach
      browser code (`docs/ARCHITECTURE.md` §9); a mismatched name between code and Vercel/Supabase
      config fails silently, not loudly.
- [ ] Identify exactly where each variable must be configured: Vercel project settings, Supabase
      Edge Function secrets, or local `.env` — these are three different places and a variable
      set in one does not exist in the others.

---

## 6. Production Verification (Mandatory)

A successful build is not proof the feature works. Every feature must be walked through the
complete production flow it actually depends on, and each stage's real result recorded — not
the stage merely named.

**Document upload — the reference flow for this repo:**

```
Browser
  ↓
Vercel Frontend (ComplianceIntakePanel.tsx)
  ↓
documentIngestPipeline.ts (base64 conversion, prompt build)
  ↓
Supabase Edge Function — ocr-proxy
  ↓
OCR Provider (Google Document AI)
  ↓
Supabase Edge Function — ai-proxy / gemini-proxy
  ↓
AI Provider (Claude / Gemini, per VITE_AI_PROVIDER)
  ↓
responseValidator.ts → Canonical Extraction (ExtractedFields)
  ↓
documentRegistry.ts validate() — single-document validation
  ↓
crossDocumentValidation.ts — cross-document validation (via useComplianceAlerts.ts)
  ↓
verificationStore.ts → DocumentVerificationModal.tsx — verification engine
  ↓
Supabase Postgres (document_extractions, application tables)
  ↓
UI (DossierGate.tsx, ComplianceHealthSidebar.tsx)
```

Every stage on this list is verified individually before the feature is called done — this is
exactly the flow where the original incident hid: build, git, and Vercel were all green while the
second `Supabase Edge Function` box had never been deployed. Other features will have a
different flow (e.g. auth, renewals, settings); state the actual flow for the feature at hand and
walk it the same way. Where a real end-to-end run isn't possible in the current session (no live
credentials, no deployed environment — as happened for Gemini in Phase 1.6), say so explicitly as
an open item rather than reporting the feature complete.

---

## 7. Completion Checklist

Every implementation ends with a report in this shape. Unchecked items are open items, stated as
such — not omitted.

```markdown
### Code
- [ ] Files changed: <list>
- [ ] Protected files modified: <none, or file + justification per §3>
- [ ] Architecture preserved: <which §2 principles apply and how they were kept>

### Build
- [ ] Build successful (`bun run build`)
- [ ] Type checking successful (`bunx tsc --noEmit`)

### Infrastructure
- [ ] Migrations applied: <list, or "none required">
- [ ] Functions deployed: <list + verification method>
- [ ] Storage verified: <bucket/policy, or "none required">
- [ ] Secrets verified: <names checked present, or names documented missing>
- [ ] Environment variables verified: <names + where configured>

### Deployment
- [ ] Production deployment verified: <Vercel deployment + commit>
- [ ] Endpoints reachable: <which, how checked>
- [ ] CORS verified: <preflight check result, or N/A>
- [ ] Authentication verified: <session/JWT path checked>

### Testing
- [ ] End-to-end test completed: <what was actually run>
- [ ] Production flow verified: <the walked flow from §6, stage by stage>
- [ ] Remaining manual steps documented: <what's left, for whom>

### Git
- [ ] Commit hash: <sha>
- [ ] Push confirmation: <branch + confirmation the remote reflects it>
```

---

## 8. Definition of Done

BrokerMindAI adopts the following Definition of Done. A feature is complete only when:

✅ Architecture complete
✅ Implementation complete
✅ Build succeeds
✅ Infrastructure updated
✅ Deployment complete
✅ Production verified

**GitHub being up to date, or a successful build, does not by itself satisfy the Definition of
Done.** Both are necessary; neither is sufficient. This sentence exists because it was, once,
treated as sufficient, and the feature still didn't work.

---

## 9. Future Claude Sessions

From this point forward, every implementation in this repository — carried out by a Claude
session or otherwise — follows this engineering standard automatically, without needing to be
reminded per task. Concretely:

- Before declaring any phase or feature complete, walk §4 (Infrastructure Audit) explicitly, even
  when the change looks frontend-only.
- Before declaring any phase or feature complete, produce the §7 Completion Checklist, not a
  prose summary that omits it.
- If any required infrastructure or deployment work is identified but not yet done, the task
  **remains Incomplete** — report it as such, with the specific open items named, rather than as
  a finished feature with footnotes.
- "Build passed" is never, by itself, the basis for reporting a feature as working in production.
  See §1 — it is Stage 3 of 6.
