# BrokerMindAI — Backend Schema

Status: Consolidated from `supabase/migrations/*.sql` (all files applied in order) as of
2026-07-21. This supersedes the table list in `docs/PROJECT_STATE.md` ("Current Database"),
which understates what's actually implemented — treat this document as the source of truth for
schema and regenerate it after any new migration.

**Shared project:** this app and the Launchpad marketing/waitlist site are separate repos and
separate Vercel projects but **share one Supabase project** (`kwdusucahpkfomjiyhie`). Schema
changes here are shared infrastructure — see `docs/ARCHITECTURE.md` §1.

---

## 1. Enums

| Enum | Values |
|---|---|
| `employment_type` | `Salaried`, `Self-Employed`, `Incorporated` |
| `review_status` | `Draft`, `In Review`, `Ready for Review`, `Approved`, `Declined`, `New`, `Documents Requested`, `Conditions Issued`, `Funded`, `Withdrawn` |
| `app_role` | `admin`, `moderator`, `user` |

## 2. Shared functions & triggers

| Function | Purpose |
|---|---|
| `update_updated_at_column()` | Generic `updated_at = now()` trigger, attached across most tables. |
| `set_user_id_default()` | `SECURITY DEFINER`; forces `NEW.user_id := auth.uid()` on INSERT — prevents client-side spoofing of ownership. `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`; only invocable via trigger. |
| `enforce_incorporated_requires_t2()` | Blocks `review_status = 'Ready for Review'` for an `Incorporated` applicant unless a `T2` row exists in `application_documents`. Database-enforced compliance rule — see `docs/TRD.md` §2.2. |
| `has_role(_user_id, _role)` | `SECURITY DEFINER STABLE`; checks `user_roles`. |
| `audit_row_change()` | `SECURITY DEFINER`; generic AFTER INSERT/UPDATE/DELETE trigger writing to `audit_logs`. Attached to `underwriting_applications`, `parsed_documents`, `compliance_flags`, `conditions`. |
| `is_firm_member(_firm_id)` / `current_firm_id()` | `SECURITY DEFINER STABLE`; firm-scoped RLS helpers. |

## 3. Tables

### `underwriting_applications` — the core application record
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` (PK) |
| application_number | text | NO | — |
| taxpayer_name | text | NO | — |
| tax_year | integer | NO | — |
| line_15000_total_income | numeric(14,2) | NO | 0 |
| line_23600_net_income | numeric(14,2) | NO | 0 |
| balance_owing | numeric(14,2) | NO | 0 |
| has_arrears | boolean | NO | false |
| aggregate_risk_score | integer | NO | 0 |
| gds | numeric(6,2) | NO | 0 |
| tds | numeric(6,2) | NO | 0 |
| employment_type | employment_type | NO | `'Salaried'` |
| review_status | review_status | NO | `'Draft'` |
| user_id | uuid | NO | `auth.uid()`; FK → `auth.users(id)` ON DELETE CASCADE |
| property_address | text | yes | — |
| loan_amount | numeric(14,2) | NO | 0 |
| deal_type | text | yes | — |
| province | text | yes | — |
| lender_name | text | yes | — |
| is_priority | boolean | NO | false |
| firm_id | uuid | yes | FK → `firms(id)` ON DELETE CASCADE |
| created_at / updated_at | timestamptz | NO | `now()` |

Indexes: `created_at DESC`, `taxpayer_name`, `application_number`, `user_id`.
Triggers: force `user_id` on insert; enforce T2-for-incorporated; audit on I/U/D.

### `document_registry` — reference data
`id` (PK), `code` (unique, e.g. `T1`/`T2`/`T4`/`T4A`/`T5`/`T2125`/`T5013`/`NOA`), `category`,
`label`, `description`, `required_fields` (jsonb `[]`), `validation_rules` (jsonb `[]`),
`firm_id`, `created_at`/`updated_at`.

### `application_documents`
`id` (PK), `application_id` (FK → `underwriting_applications` ON DELETE CASCADE),
`document_code` (FK → `document_registry(code)`), `tax_year`, `payload` (jsonb `{}`), `firm_id`,
`created_at`/`updated_at`. Indexes: `application_id`, `document_code`.

### `compliance_alerts`
`id` (PK), `application_id` (FK → `underwriting_applications` ON DELETE CASCADE, nullable),
`document_code`, `alert_code` (NOT NULL), `severity` (default `'WARN'`), `message` (NOT NULL),
`details` (jsonb `{}`), `resolved` (default false), `firm_id`, `created_at`/`updated_at`.
Indexes: `application_id`, `alert_code`. **Realtime-enabled** (in `supabase_realtime`
publication, `REPLICA IDENTITY FULL`) — backs the live compliance feed.

### `parsed_documents`
`id` (PK), `user_id` (default `auth.uid()`), `application_id` (FK, nullable), `document_code`
(NOT NULL), `source_path`, `parsed_payload` (jsonb `{}`), `confidence` (default 0), `firm_id`,
`created_at`/`updated_at`. Indexes: `user_id`, `application_id`. Audited on I/U/D.

### `audit_logs` — append-only
`id` (PK), `user_id` (default `auth.uid()`), `application_id` (FK ON DELETE SET NULL), `action`,
`entity_type`, `entity_id`, `details` (jsonb `{}`), plus `action_type`, `table_name`,
`record_id`, `old_value`/`new_value` (jsonb), `ip_address`, `firm_id`, `created_at`. Indexes:
`user_id`, `application_id`. **No UPDATE/DELETE policy exists** — immutable by design.

### `compliance_flags`
`id` (PK), `user_id` (default `auth.uid()`), `application_id` (FK ON DELETE CASCADE), `code`
(NOT NULL), `severity` (default `'WARN'`), `status` (default `'open'`), `message` (NOT NULL),
`note`, `firm_id`, `created_at`/`updated_at`. Indexes: `user_id`, `application_id`. Audited.

### `conditions`
`id` (PK), `user_id` (default `auth.uid()`), `application_id` (FK NOT NULL ON DELETE CASCADE),
`label` (NOT NULL), `description`, `status` (default `'open'`), `due_date`, `firm_id`,
`created_at`/`updated_at`. Indexes: `user_id`, `application_id`. Audited. Backs
`ConditionsBoard`.

### `renewals`
`id` (PK), `user_id` (default `auth.uid()`), `application_id` (FK, nullable), `lender` (NOT
NULL), `maturity_date`, `current_rate`, `renewal_status` (default `'upcoming'`), `notes`,
`firm_id`, `client_name`, `property_address`, `current_balance`, `last_contact_at`,
`created_at`/`updated_at`. Indexes: `user_id`, `application_id`.

> **Fixed 2026-07-21:** `src/routes/lender.tsx` previously read a `balance` column that no
> migration ever created — only `current_balance` exists (`RenewalPipelinePanel.tsx` always
> used the correct name). `lender.tsx` now selects/reads `current_balance` throughout. See
> `docs/TRD.md` §3.

### `rate_holds`
`id` (PK), `user_id` (default `auth.uid()`), `application_id` (FK, nullable), `lender` (NOT
NULL), `rate` (NOT NULL), `expiry_date` (NOT NULL), `product`, `notes`, `firm_id`,
`created_at`/`updated_at`. Indexes: `user_id`, `application_id`.

### `communications_log`
`id` (PK), `user_id` (default `auth.uid()`), `application_id` (FK, nullable), `channel` (NOT
NULL), `direction` (default `'outbound'`), `subject`, `body`, `contact`, `firm_id`,
`created_at`/`updated_at`. Indexes: `user_id`, `application_id`.

### `user_roles`
`id` (PK), `user_id` (FK → `auth.users` ON DELETE CASCADE), `role` (`app_role`, NOT NULL),
`firm_id`, `created_at`. UNIQUE(`user_id`, `role`). See `docs/ARCHITECTURE.md` §8 for the
planned extension to a full RBAC hierarchy.

### `broker_settings`
`user_id` (PK, FK → `auth.users` ON DELETE CASCADE), `broker_name`, `broker_email`,
`licence_number`, `brokerage_name`, `phone`, `signature`, `direct_phone`, `mailing_address`,
`provinces` (text[] default `{}`), `logo_url`, `primary_color`, `accent_color`,
`white_label_enabled` (default false), `email_sender_name`, `firm_id`, `created_at`/`updated_at`.

### `file_notes` — append-only
`id` (PK), `application_id` (FK NOT NULL ON DELETE CASCADE), `user_id` (default `auth.uid()`),
`author_name`, `note_type` (default `'general'`, CHECK IN `general|flag|lender_communication`),
`body` (NOT NULL), `firm_id`, `created_at`. Index: `(application_id, created_at DESC)`. **Only
SELECT/INSERT policies** — immutable.

### `user_preferences`
`user_id` (PK, default `auth.uid()`), `theme` (default `'dark'`, CHECK `dark|light`),
`default_export` (default `'pdf'`, CHECK `pdf|xlsx`), `email_notifications`,
`in_app_notifications`, `notif_rate_hold`, `notif_condition_overdue`,
`notif_renewal_approaching`, `notif_new_flag` (all default true), `default_amortization`
(default 25), `default_term` (default 5), `default_heating_cost` (default 150),
`onboarding_completed` (default false), `firm_id`, `created_at`/`updated_at`.

### `integration_status`
`id` (PK), `user_id` (default `auth.uid()`), `provider` (CHECK `mindee|flinks|plaid`), `status`
(default `'not_configured'`, CHECK `connected|not_configured|error`), `key_last4`,
`last_tested_at`, `last_error`, `firm_id`, `created_at`/`updated_at`. UNIQUE(`user_id`,
`provider`).

### `firms`
`id` (PK), `name` (default `'My Firm'`), `plan` (default `'solo'`), `created_at`/`updated_at`.

### `firm_members`
`id` (PK), `firm_id` (FK ON DELETE CASCADE), `user_id` (FK → `auth.users` ON DELETE CASCADE),
`is_owner` (default false), `created_at`. UNIQUE(`firm_id`, `user_id`).

### `notifications`
`id` (PK), `user_id` (FK ON DELETE CASCADE), `firm_id` (FK ON DELETE CASCADE), `type` (NOT
NULL), `title` (NOT NULL), `body`, `entity_type`, `entity_id`, `severity` (default `'info'`),
`read_at`, `email_sent_at`, `dedupe_key`, `created_at`. UNIQUE(`user_id`, `dedupe_key`). Index:
`(user_id, created_at DESC)`.

### `lender_policies`
`id` (PK), `firm_id` (FK ON DELETE CASCADE), `name` (NOT NULL), `version` (default 1),
`is_active` (default true), `max_ltv_detached`/`max_ltv_condo`/`max_ltv_rural`, `min_beacon`,
`max_tds`/`max_gds`, `acceptable_income_types` (text[] `{}`), `eligible_provinces` (text[]
`{}`), `notes`, `created_by` (FK → `auth.users`), `created_at`/`updated_at`.

### `term_sheets`
`id` (PK), `firm_id` (FK ON DELETE CASCADE), `application_id` (FK ON DELETE SET NULL),
`policy_id` (FK → `lender_policies` ON DELETE SET NULL), `policy_version`, `borrower_name`,
`property_address`, `loan_amount`, `rate`, `term_months`, `fees`, `conditions` (jsonb `[]`),
`merge_data` (jsonb `{}`), `status` (default `'draft'`), `created_by` (FK → `auth.users`),
`created_at`/`updated_at`.

### `document_extractions` — append-only AI telemetry (newest table, added 2026-07-20)
`id` (PK), `firm_id` (FK NOT NULL ON DELETE CASCADE), `application_id` (FK ON DELETE SET NULL),
`document_id` (stable per uploaded document, reused across replays), `document_kind` (NOT
NULL), `definition_version`, `prompt_version` (NOT NULL), `ocr_provider`/`ocr_model`,
`llm_provider`/`llm_model`, `raw_ocr_text`, `raw_claude_response` (jsonb),
`structured_json` (jsonb), `validation_outcome` (jsonb `{}`), `started_at` (NOT NULL),
`completed_at`, `latency_ms`, `input_tokens`/`output_tokens`, `estimated_cost`, `success`
(default false), `error_code`/`error_message`, `source` (default `'upload'`), `is_replay`
(default false), `page_count`, `created_by` (FK → `auth.users` ON DELETE SET NULL),
`created_at`. Indexes: `firm_id`, `application_id`, `document_id`, `document_kind`, `created_at
DESC`. **Only SELECT/INSERT policies** — immutable, matches `audit_logs` convention. See
`docs/ARCHITECTURE.md` §5 for what this records and why.

## 4. Row-Level Security summary

| Table | Policy |
|---|---|
| `underwriting_applications` | Owner (`user_id = auth.uid()`) full CRUD; firm members SELECT (`firm_id IS NOT NULL AND is_firm_member(firm_id)`) |
| `application_documents` | Owner-via-parent-application CRUD; firm members SELECT |
| `compliance_alerts` | Owner-via-parent-application CRUD (insert/update/delete require application ownership; select allows NULL `application_id` or ownership); firm members SELECT |
| `document_registry` | Authenticated read-only reference data |
| `parsed_documents` | Owner full CRUD (insert requires app ownership if `application_id` set); firm members SELECT |
| `audit_logs` | Owner INSERT/SELECT only (no update/delete); `has_role(uid,'admin')` SELECT all; firm members SELECT |
| `compliance_flags` | Owner full CRUD (insert requires app ownership if set); firm members SELECT |
| `conditions` | Owner full CRUD (insert requires app ownership); firm members SELECT |
| `renewals` | Owner full CRUD; firm members SELECT |
| `rate_holds` | Owner full CRUD; firm members SELECT |
| `communications_log` | Owner full CRUD; firm members SELECT |
| `user_roles` | User views own roles OR admin views all; admins manage all via `has_role` |
| `broker_settings` | Owner-only ALL |
| `file_notes` | Read/insert restricted to owners of the parent application (no update/delete); firm members SELECT |
| `user_preferences` | Owner-only ALL |
| `integration_status` | Owner-only ALL |
| `firms` | Members SELECT (`is_firm_member`); owner-flagged member UPDATE; any authenticated user can INSERT (create a firm) |
| `firm_members` | Members SELECT roster; firm owners manage (ALL); users can INSERT themselves (join) |
| `notifications` | Owner-only ALL |
| `lender_policies` | Firm members SELECT and full manage (ALL) |
| `term_sheets` | Firm members SELECT and full manage (ALL) |
| `document_extractions` | Firm members SELECT and INSERT only (immutable telemetry) |
| `storage.objects` (`brokerage-logos` bucket) | Users can SELECT/INSERT/UPDATE/DELETE only within their own `auth.uid()`-prefixed folder |

`anon` had broad access during an early demo phase but was **fully revoked** in migration
`20260627095648` — every app table now requires an `authenticated` session (or `service_role`
for edge functions).

## 5. Supabase Edge Functions (`supabase/functions/*`)

| Function | Purpose |
|---|---|
| `ai-proxy` | Proxies Anthropic Claude (Messages API) for document extraction / AI features, using vault-stored `ANTHROPIC_API_KEY`. |
| `ocr-proxy` | Proxies Google Document AI for raw OCR text extraction, using `GOOGLE_DOCUMENT_AI_KEY`. |
| `flinks-proxy` | Proxies the Flinks Canadian bank-data aggregator API, using `FLINKS_CLIENT_ID`. |
| `plaid-proxy` | Proxies the Plaid API (secondary/fallback to Flinks), using `PLAID_SECRET`/`PLAID_CLIENT_ID`. |
| `_shared/proxy.ts` | Shared helper (not directly callable) — CORS handling, JWT-based `getUserId`, and a 100 calls/hour/user/function in-memory rate limiter (`guard()`). All four proxies call it before forwarding a request. See `docs/TRD.md` §3 for the durability caveat on this limiter. |

## 6. Verified consistency notes

- Every `.from(...)` table reference found in `src/` corresponds to a table created in
  migrations, **except** the `renewals.balance` mismatch noted above.
- `application_documents`, `parsed_documents`, and `document_registry` are used via generated
  Supabase types (`src/integrations/supabase/types.ts`) rather than always via a literal
  `.from("...")` call — present and in use, just not always grep-visible.
- `document_extractions` is write-only from the app today (no reader UI yet) — expected, per
  its migration comment reserving it for a future Internal Tools surface.
