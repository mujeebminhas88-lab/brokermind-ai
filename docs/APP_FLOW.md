# BrokerMindAI — App Flow

Status: Draft, as of 2026-07-21. Describes user/screen flow through the shipped product. See
`docs/UI_UX_DESIGN.md` for the route inventory and `docs/ARCHITECTURE.md` for the technical
data-flow (document ingestion sequence diagram).

---

## 1. Authentication flow

```
/signup ──(supabase.auth.signUp)──► email confirmation notice
                                            │
/login ──(supabase.auth.signInWithPassword)─┤
                                            ▼
                                   session established
                                            │
                              AuthGate passes ─► redirect target
                                   (default: /dashboard, or a
                                    validated `redirect` param)

/forgot-password ──(resetPasswordForEmail)──► reset email
/reset-password   ──(auth.updateUser, via email link)──► /login
```

- Every substantive route is wrapped in `AuthGate.tsx`; an unauthenticated visit redirects to
  `/login?redirect=<original path>` (open-redirect-loop-safe: auth pages are excluded as valid
  redirect targets).
- Sessions have a 15-minute inactivity timeout with a warning modal (`useUser.tsx`).
- Login/logout are audit-logged (`audit_logs`, action `LOGIN`/`LOGOUT`).
- First login after signup with no prior firm membership triggers the onboarding wizard (see
  §4).

## 2. Primary navigation map

```
                              ┌────────────┐
                    ┌────────►│ /dashboard │◄────────┐
                    │         └─────┬──────┘         │
                    │               │                │
              (new/select file)     │           (nav header,
                    │               │            always available)
                    ▼               ▼                │
              ┌───────────┐   ┌───────────┐    ┌──────────────┐
              │     /     │   │ /pipeline │    │ /compliance  │
              │ (Dossier  │◄──┤  (kanban/ │    │ (firm-wide   │
              │ workbench)│   │   table)  │    │  alert feed) │
              └─────┬─────┘   └───────────┘    └──────────────┘
                    │
        ┌───────────┼─────────────┬───────────────┐
        ▼           ▼             ▼                ▼
   /renewals     /lender      /settings      (export/print:
  (tracker)   (portfolio       (tabs)          dossier PDF,
              dashboard)                        term sheet)
```

`AppHeader.tsx` provides persistent navigation between all top-level routes; there is no deep
routing within `/` itself (the workspace is panel-based within a single route, not sub-routed).

## 3. Core underwriting flow (the primary value path)

```
1. Dashboard → "New Application" (NewApplicationModal)
        │
        ▼
2. Applicant selected/created in the Dossier workbench ( / )
        │
        ▼
3. Intake: loan terms, employment, co-applicant, subject property,
   REO matrix, liabilities  (writes to applicationStore + related stores)
        │
        ▼
4. Document upload (ComplianceIntakePanel)
        │
        ▼
5. documentIngestPipeline: OCR provider → AI provider → validated JSON
   (see docs/ARCHITECTURE.md §2 for the technical sequence)
        │
        ▼
6. DocumentVerificationModal — human reviews/corrects/locks every
   AI-extracted field (mandatory checkpoint, never skipped)
        │
        ▼
7. Verified data flows into:
     - documentRegistry / compliance engine → compliance_alerts,
       compliance_flags (FINTRAC/AML, income mismatch, arrears,
       T2-required-for-incorporated — this one is DB-enforced)
     - Risk panels: StressTestPanel (OSFI B-20), CmhcPanel,
       CreditProfilePanel, RentalOffsetPanel, LenderSuitabilityPanel
        │
        ▼
8. Conditions raised as needed (ConditionsBoard → conditions table)
        │
        ▼
9. DossierGate — blocks completion until AML, source-of-funds, and
   document verification are all satisfied
        │
        ▼
10. TermSheetGenerator / dossier PDF export (jsPDF) → file considered
    ready for lender submission
        │
        ▼
11. Post-funding: RateHoldPanel / RenewalPipelinePanel track the file
    forward toward its next renewal/maturity date
```

Every step from 5 onward writes to `audit_logs` and, for extractions specifically, to the
append-only `document_extractions` telemetry table (never surfaced in UI yet — see
`docs/TRD.md` §3).

## 4. Onboarding flow (first-run)

```
First login, no firm membership
        │
        ▼
OnboardingWizard (4 steps):
  1. Firm profile (name, licence, branding basics)
  2. First applicant created
  3. First document uploaded
  4. First AI action run
        │
        ▼
user_preferences.onboarding_completed = true
        │
        ▼
Normal dashboard flow from here on
   (wizard is resettable from Settings for re-testing/demo purposes)
```

## 5. Firm / team flow

```
Signup ──► firms row created (owner) OR firm_members join (invited)
                    │
                    ▼
         Settings → Team & Access
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Manage roles              Invite members
  (today: single           (firm_members insert —
   isAdmin boolean;         planned 4-tier RBAC,
   see docs/ARCHITECTURE    see docs/ARCHITECTURE
   §8 for the planned       §8, not yet built)
   role hierarchy)
```

Firm members can `SELECT` any application/document/alert scoped to their `firm_id` (see
`docs/BACKEND_SCHEMA.md` RLS matrix) — the pipeline, compliance feed, and lender dashboard are
all firm-wide views by design, while the workspace itself (`/`) still centers on one applicant
at a time.

## 6. Renewals & rate-hold monitoring flow (ongoing, not linear)

```
renewals / rate_holds records age toward maturity_date / expiry_date
        │
        ▼
Dashboard "needs attention" + /renewals urgency coding
        │
        ▼
CommunicationsPanel — AI-drafted outreach, logged to communications_log
        │
        ▼
(renewal converts to a new application, or rate hold extended/locked)
```

## 7. Developer Mode flow (non-customer path)

```
Admin-authenticated session → Settings (hidden entry point, never
   linked from customer-facing nav)
        │
        ▼
JSON upload bypasses OCR/AI providers entirely
   (documentIngestPipeline.ingestFromJson — reads test fixture verbatim)
        │
        ▼
Same downstream path as a real document (verification → compliance →
   dossier) — lets the whole UI be tested without AI spend
```

Per `docs/DECISIONS.md`, this must remain permanently available to developers/admins but never
reachable by a customer session.
