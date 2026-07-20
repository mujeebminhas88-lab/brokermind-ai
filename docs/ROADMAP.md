# BrokerMindAI — Roadmap

━━━━━━━━━━━━━━

✅ Phase 0
Platform stabilization (Launchpad)

✔ Remove Lovable
✔ Waitlist
✔ MailerLite
✔ Production deployment

━━━━━━━━━━━━━━

🚧 Phase 1
AI Document Pipeline

✔ Document Definition Registry (src/documentDefinitions/)
✔ Prompt Builder (generates Claude prompts from DocumentRegistry fields — no duplicated schemas)
✔ Response Validator (unwrap envelope, strip fences, parse, align field names)
✔ documentIngestPipeline.ts wired into ComplianceIntakePanel.onFile()
✔ Extraction telemetry (document_extractions) — capturing from day one
✔ Remove process-noa (demo mock pipeline, confirmed unreferenced)
✔ Remove forensic-parse (regex pipeline, confirmed unreferenced)
✔ Remove NoaUploader (orphaned, never rendered)
□ Deploy ocr-proxy + ai-proxy edge functions (blocked on manual action — see below)
□ Configure GOOGLE_DOCUMENT_AI_KEY / GOOGLE_DOCUMENT_AI_ENDPOINT / ANTHROPIC_API_KEY in the Supabase vault

The verification engine (documentRegistry.ts, verificationStore.ts, processDocument(),
aggregateCompliance(), DocumentVerificationModal, DossierGate) was preserved untouched
throughout — the pipeline conforms to its existing payload contract rather than the
other way around. See docs/ARCHITECTURE.md.

Manual step before this phase is truly live: the two required edge functions are not
yet deployed and no AI provider secrets are configured. Until then, real document
uploads will fail gracefully (a clear error, not a crash) and the isolated JSON test
path remains available.

━━━━━━━━━━━━━━

📌 Reserved Phase
Internal Tools

This is an intentional architectural milestone, not a backlog item. It stays in this
roadmap, reserved and unimplemented, until explicitly promoted to an active phase —
never quietly dropped or folded into "someday."

**Purpose**
Formalize the temporary JSON-upload/testing affordance into BrokerMindAI's permanent
engineering and operations console — the place engineering debugs, replays, and
tunes the AI document pipeline without touching customer data or requiring a deploy
for every prompt iteration.

**Planned features**
□ JSON Upload (promoted from its current temporary location in ComplianceIntakePanel)
□ OCR Replay
□ Prompt Playground (compare prompt/definition versions)
□ Raw AI Response (raw OCR output + raw Claude response viewers)
□ Cost Dashboard (AI latency, token usage, estimated cost)
□ Feature Flags
□ AI Diagnostics (pipeline diagnostics, confidence heatmap, force reprocess)

**RBAC requirements**
Super Admin only — never visible to Customer, Processor, or Admin. Requires the
user_roles enum extension (customer | processor | admin | super_admin) and a route-level
SuperAdminGate (composes the existing AuthGate with a role check), plus server-side role
verification on any new edge functions this phase introduces — client-side gating alone
is not sufficient enforcement for anything that touches the backend.

**Dependencies**
- Phase 2's RBAC work (role enum + route guard) — hard blocker for the UI.
- Phase 1's document_extractions telemetry table — hard blocker for almost every tool
  having anything to show. (Already shipped — see Phase 1 above.)
- The Document Definition Registry (Phase 1, shipped) — needed for prompt-version
  comparison and provider config tools to have structured data to read/diff.

**Suggested implementation order (when promoted from reserved)**
1. InternalTool declarative registry (id, label, category, route, minRole).
2. Observability tools first (raw OCR/Claude viewers, pipeline diagnostics) — pure
   reads of document_extractions, no new write paths, lowest risk.
3. Cost & performance dashboards — same, pure reads.
4. Replay / force-reprocess — first tools that trigger pipeline actions; needs the
   server-side role check on the edge-function side.
5. Prompt comparison / feature flags / provider config — the configuration-mutation
   tools, deliberately last since they're the highest-blast-radius category.

**Reason it is intentionally deferred**
The architecture, RBAC boundary, and data dependency are being designed and reserved
now so the eventual build is additive, not a refactor — but the UI itself has no
customer-facing urgency, and building it before Phase 2's RBAC exists would mean
either shipping it unprotected or building a throwaway auth shim.

━━━━━━━━━━━━━━

🔒 Phase 2
Authentication
(RBAC + 2FA)

□ user_roles enum: customer | processor | admin | super_admin (extends today's
  boolean isAdmin — additive, not a rewrite)
□ Route-level RBAC guard (SuperAdminGate, tenant-role checks)
□ 2FA

Foundation already shipped, not starting from zero: real Supabase Auth session
management (UserProvider/AuthGate), audit logging (audit_logs + logAuditEvent),
and a single boolean admin role (user_roles + useUserRole) all already exist and
are in production use (e.g. AuditLogViewer in /settings).

━━━━━━━━━━━━━━

📄 Phase 3
Additional Documents

□ Driver Licence
□ Passport
□ Bank Statements
□ T1
□ T4
□ Employment Letter

Each new document type is a new entry in documentRegistry.ts (fields/extract/validate)
plus, only if it needs something other than the defaults, an override in
documentDefinitions/registry.ts. No pipeline code changes required — this is the
direct payoff of the Phase 1 architecture.

━━━━━━━━━━━━━━

🤖 Phase 4
Cross-document Intelligence

□ Income reconciliation
□ Fraud detection
□ Identity consistency
□ Risk scoring
□ Underwriting recommendations

━━━━━━━━━━━━━━

## Future billing & usage accounting (design constraint, not a phase)

Not implemented in Phase 1, but the data model already supports it without a future
migration:

- Billing is designed around **processed files**, not AI credits or tokens. Customers
  only ever see: monthly files used, remaining files, next reset date, plan limits.
- A replay is a completely new OCR + AI execution and counts as one processed file —
  it never overwrites a previous extraction (document_extractions is append-only by
  design: no UPDATE/DELETE policies).
- No mutable "credit balance" anywhere. Usage is computed from successful processing
  records (document_extractions rows), not decremented from a balance.
- Everything — usage, limits, processing history — belongs to the **firm** (workspace),
  not the individual user, via the existing firm_id scoping already applied to
  document_extractions.
- Provider-agnostic by construction: document_extractions records provider/model per
  row, so swapping or adding OCR/LLM providers never touches billing or reporting.
