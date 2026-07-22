# BrokerMindAI — Start Here

Read **`docs/README.md`** first — it's the documentation index. In particular:

- **`docs/ENGINEERING_STANDARDS.md` is mandatory.** Before declaring any feature/phase done, walk
  its Infrastructure Audit and produce its Completion Checklist. A green build is stage 3 of 6
  (see that doc's lifecycle) — not completion.
- **`docs/PROJECT_STATE.md`** is the single "what's true right now" snapshot.
- **`docs/ARCHITECTURE.md`** is the system architecture (document ingestion pipeline, provider
  abstraction, verification engine).

## Protected files — do not modify without explicit justification

- `src/utils/documentRegistry.ts` (extending via new registry entries is fine and expected —
  rewriting `processDocument()`/`aggregateCompliance()`/`runSuperPriorityChecks()` is not, without
  justification)
- `src/store/verificationStore.ts`
- `src/components/DocumentVerificationModal.tsx`
- `src/components/DossierGate.tsx`

## Where things live

- Document ingestion pipeline: `src/lib/documentIngestPipeline.ts`
- OCR/AI provider abstraction: `src/providers/{ocr,ai}/`
- Document Registry (schema/extract/validate per document kind): `src/utils/documentRegistry.ts`
- Cross-document validation (Phase 1.7): `src/utils/crossDocumentValidation.ts`
- Unified compliance alerts (feeds `DossierGate`): `src/hooks/useComplianceAlerts.ts`
- Supabase Edge Functions: `supabase/functions/*` — auto-deployed on push to `main` via
  `.github/workflows/deploy-supabase-functions.yml` (requires the `SUPABASE_ACCESS_TOKEN` repo
  secret, already configured)

## Infrastructure notes worth knowing before touching anything

- This app **shares one Supabase project** (`kwdusucahpkfomjiyhie`) with the `brokermind-launchpad`
  marketing repo. Schema/secret changes here are shared infrastructure.
- Edge Functions require `verify_jwt = false` in `supabase/config.toml` (already set for all five
  functions) — otherwise the CORS preflight gets rejected before the function's own code runs,
  which looks identical to "function not deployed" in the browser.
- Client-exposed config must be `VITE_`-prefixed to ever reach browser code (Vite build-time
  inlining) — a bare `GEMINI_API_KEY` set in **Vercel** is never visible to the `gemini-proxy`
  **Supabase Edge Function** (different platforms, different secret stores entirely). Provider
  secrets (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_DOCUMENT_AI_KEY`) belong in Supabase
  (`supabase secrets set ... --project-ref kwdusucahpkfomjiyhie`), not Vercel.
- `VITE_INGESTION_MODE` (`pipeline` default, or `native`) and `VITE_AI_PROVIDER`/`VITE_OCR_PROVIDER`
  are `VITE_`-prefixed Vercel env vars — they're baked in at **build time**, so changing them in
  the Vercel dashboard requires a redeploy to actually take effect, not just a save.

## As of 2026-07-22 — in progress

Just shipped native-document ingestion mode (`VITE_INGESTION_MODE=native`, lets Gemini or Claude
read a raw file directly, skipping the Google Document AI OCR step — see `docs/ARCHITECTURE.md`
§9). User was mid-verification: confirming `GEMINI_API_KEY` is set in Supabase (not just Vercel),
Vercel env vars (`VITE_INGESTION_MODE=native`, `VITE_AI_PROVIDER=gemini`) added and redeployed,
and a real document upload not yet confirmed working end-to-end. **Next step when resuming:** ask
the user whether the upload test succeeded, and if not, get the exact error message.
