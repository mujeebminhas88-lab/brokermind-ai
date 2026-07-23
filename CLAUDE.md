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

## As of 2026-07-23 — in progress

Timeline: shipped native-document ingestion mode (`VITE_INGESTION_MODE=native`) first, then hit a
dead Gemini model string (`gemini-2.5-flash` → 404 for new API keys; fixed to the maintained alias
`gemini-flash-latest` in both `ai/geminiProvider.ts` and `gemini-proxy`, confirmed deployed via
GitHub Actions run `30001647945`, `conclusion: success`). The user then clarified their actual
intent: they explicitly do **not** want native mode — they want the original two-stage pipeline
(OCR → AI, both independent) preserved, just with **Gemini standing in for Google Document AI at
the OCR stage** (no `GOOGLE_DOCUMENT_AI_KEY` yet, still testing). Built accordingly: `GeminiOcrProvider`
(`src/providers/ocr/geminiOcrProvider.ts`, Phase 1.8) implements the existing `OCRProvider`
interface, calling `gemini-proxy` with a dedicated OCR-only system prompt (verbatim transcription,
explicitly told not to interpret/extract) — a separate call/prompt from `ai/geminiProvider.ts`,
even though both hit the same Gemini API. Registered behind `VITE_OCR_PROVIDER=gemini` in
`src/providers/ocr/factory.ts`. No edge function changes needed (`gemini-proxy` already accepted
either `image_base64` or `text`).

**Target Vercel config for this setup:** `VITE_OCR_PROVIDER=gemini`, `VITE_AI_PROVIDER=gemini`,
`VITE_INGESTION_MODE=pipeline` (or unset it entirely — pipeline is the default; unsetting is
simpler than setting it explicitly if `native` was previously added). Remember `VITE_` vars are
baked in at build time — changing them requires a redeploy, not just a save.

**Next step when resuming:** confirm the user has updated Vercel's env vars to the above and
redeployed, then ask them to retry a real upload and report the exact result (success, or the
exact error message) — this has not yet been confirmed working end-to-end in production.
