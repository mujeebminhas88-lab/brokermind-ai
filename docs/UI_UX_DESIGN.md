# BrokerMindAI — UI/UX Design

Status: Draft, describing the shipped UI as of 2026-07-21.

**Scope note:** this covers the BrokerMindAI *product* (this repo) — a dense, professional
underwriting workbench. It is a different design surface from the Launchpad's marketing site
(`brokermind-launchpad` repo), which follows its own `docs/creative-direction.md` cinematic
spec. The two should stay visually related (shared brand) but are not bound by the same rules —
Part B of the Launchpad's direction ("standard, accessible, comparison-friendly, ink not glow")
is the closer relative of the two.

---

## 1. Design system

- **Component library:** shadcn/ui on Radix primitives (`src/components/ui/`), Tailwind CSS v4
  utility classes, `class-variance-authority` for variants, `cn()` (`src/lib/utils.ts`) for
  conditional class merging.
- **Default theme:** dark (`user_preferences.theme` defaults to `'dark'`, with `'light'` as the
  only alternative — a two-theme system, not a full design-token palette per theme yet).
- **Icons:** `lucide-react`.
- **Charts:** `recharts` (portfolio/dashboard metrics).
- **PDF output:** `jspdf` for dossier exports, audit sheets, and term sheets — generated
  client-side.

## 2. Layout pattern

Every authenticated route shares:
- `AppHeader.tsx` — global nav, notification bell (`NotificationBell.tsx`), branding (via
  `WhiteLabelProvider`).
- `AuthGate.tsx` — wraps every substantive route; redirects unauthenticated sessions to
  `/login` with a validated return path.
- Route body — either a dashboard/list layout (`/dashboard`, `/pipeline`, `/compliance`,
  `/lender`, `/renewals`) or the dense multi-panel workspace (`/`), or a tabbed settings shell
  (`/settings`).

Unauthenticated routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`) share a
lighter `AuthShell` layout defined in `login.tsx`.

## 3. Route inventory

| Route | Purpose | Primary layout |
|---|---|---|
| `/` | The "Dossier" workbench — full underwriting workspace for one applicant at a time (~20 panels: loan terms, tax slips, compliance, credit, stress test, conditions, communications, term sheet). The core product surface. | Multi-panel, tabbed/collapsible sections |
| `/dashboard` | Broker's book overview: active files, needs-attention alerts, rate-hold expiries, upcoming renewals, recent activity. Entry point after login. | Card/summary grid + activity feed |
| `/pipeline` | Deal pipeline: kanban (by `review_status`) and table views, saved filters, realtime updates. | Kanban + table toggle |
| `/compliance` | Firm-wide compliance alert feed, filterable, realtime, severity-sorted. | List/table |
| `/lender` | Private-lender portfolio dashboard: book value, avg LTV/rate, provincial concentration, maturity schedule, risk exposure. | Metrics grid + charts |
| `/renewals` | Renewal tracker with urgency coding. | Table |
| `/settings` | Tabbed: Firm Profile, Branding, Integrations, Team & Access, Lender Policies, Preferences, Audit Trail. | Tabs |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth flows. | Centered form (`AuthShell`) |

See `docs/APP_FLOW.md` for how these connect.

## 4. Component conventions

- **One "Panel" per domain concept**, named `<Domain>Panel.tsx` (e.g. `LoanTermsPanel`,
  `CreditProfilePanel`, `RateHoldPanel`, `ExitStrategyPanel`). Each panel pairs with a matching
  Zustand store (`<domain>Store.ts`) — state and presentation are split consistently across the
  whole app. New features should follow this pairing rather than introducing ad hoc local state
  for anything that needs to persist or be shared across panels.
- **Status/severity conventions:** `StatusBadge.tsx` is the shared status-pill component; alert
  severity uses a `WARN` / `HIGH` / `CRITICAL` scale (`compliance_alerts.severity`,
  `ComplianceAlertBanner.tsx`) — any new alert-producing feature should reuse this scale rather
  than inventing a new one.
- **Gating pattern:** `DossierGate.tsx` blocks dossier/export completion until AML, source-of-funds,
  and document verification are all satisfied — the model for any future "can't proceed until X"
  UI.
- **White-label branding:** `WhiteLabelProvider.tsx` + `broker_settings` (logo, primary/accent
  color, `white_label_enabled`) — firm-level branding is a first-class concept, not a
  per-component override.

## 5. Key interaction flows (UI-level)

- **Document verification:** `DocumentVerificationModal.tsx` is the mandatory human checkpoint
  between AI extraction and the applicant record — every AI-extracted field is presented for
  review/correction/lock before it counts as verified (`verificationStore.ts` lifecycle:
  `uploaded → pending → review → verified`).
- **Sandbox mode:** the `/` workspace supports uncommitted scenario changes (test "what if"
  numbers without persisting) — surfaced via `SandboxPanel.tsx`. Any new financial-input panel
  should respect sandbox mode rather than writing straight through.
- **Onboarding:** `OnboardingWizard.tsx` — 4 steps (firm profile → first applicant → first
  document → first AI action) on first run, tracked via `user_preferences.onboarding_completed`.
- **Notifications:** `NotificationBell.tsx` + `notifications` table, deduplicated via
  `dedupe_key`, generated by `useNotificationGenerator.ts`.

## 6. Accessibility

Not yet audited for this app. The Launchpad repo's marketing site has an explicit accessibility
pass (reduced-motion, focus-visible rings, semantic landmarks — see its README); this product
UI has not received an equivalent pass. Given the density of the `/` workspace (≈20 panels) and
its financial/compliance nature, this should be treated as a real gap, not a nice-to-have — see
`docs/IMPLEMENTATION_PLAN.md`.

## 7. Known gaps

- No documented design tokens (spacing/typography/color scale) beyond Tailwind defaults + the
  two-theme (`dark`/`light`) preference — worth formalizing if the UI grows further before it
  drifts into inconsistency.
- No responsive/mobile design has been verified; the workspace's panel density suggests desktop
  is the assumed primary surface. Should be stated explicitly as a decision (or fixed) rather
  than left implicit.
