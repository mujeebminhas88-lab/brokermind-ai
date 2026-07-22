# BrokerMindAI — Documentation Index

Start here. Every doc below is permanent project documentation, not a one-off note — keep it
current as the system changes rather than letting it drift and adding a newer doc alongside it.

## Read first

| Doc | What it's for |
|---|---|
| [`ENGINEERING_STANDARDS.md`](./ENGINEERING_STANDARDS.md) | **Mandatory** engineering lifecycle for every feature — Architecture → Implementation → Build → Infrastructure → Deployment → Production Verified. Read before starting implementation work, not after. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System architecture: the document ingestion pipeline, provider abstraction, verification engine, RBAC design. |
| [`DECISIONS.md`](./DECISIONS.md) | Why things are built the way they are — provider independence, human-in-the-loop, immutable records, billing model. |
| [`PROJECT_STATE.md`](./PROJECT_STATE.md) | The single "what's true right now" snapshot — current phase, protected components, current database, AI provider status. |

## Product & design

| Doc | What it's for |
|---|---|
| [`PRD.md`](./PRD.md) | Product requirements — problem, personas, goals/non-goals, shipped features, user stories. |
| [`UI_UX_DESIGN.md`](./UI_UX_DESIGN.md) | Design system, route inventory, component conventions. |
| [`APP_FLOW.md`](./APP_FLOW.md) | User/screen flows — auth, the core underwriting flow, onboarding, firm/team. |

## Technical reference

| Doc | What it's for |
|---|---|
| [`TRD.md`](./TRD.md) | Technical requirements — stack, non-functional requirements, security/compliance constraints, known technical debt. |
| [`BACKEND_SCHEMA.md`](./BACKEND_SCHEMA.md) | Full database schema — tables, enums, RLS policy matrix, Edge Functions. |

## Planning

| Doc | What it's for |
|---|---|
| [`ROADMAP.md`](./ROADMAP.md) | Phase-by-phase product roadmap, Phase 0 through Enterprise. |
| [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) | `ROADMAP.md`'s phases turned into actionable checklists. |

## Historical

| Doc | What it's for |
|---|---|
| [`CHATGPT_SESSION_SUMMARY_2026-07-20.md`](./CHATGPT_SESSION_SUMMARY_2026-07-20.md) | A point-in-time session summary predating the current doc set — kept for history, not a source of truth (superseded by the docs above where they overlap). |
