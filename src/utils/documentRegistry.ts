/**
 * BrokerMindAI — Document Compliance Engine
 *
 * Master Document Registry. Each entry is a self-contained record describing:
 *   1. how to extract canonical fields from a raw payload (extract)
 *   2. how to validate those fields for compliance / risk (validate)
 *   3. the UI metadata needed to render an input form (category + fields)
 *
 * Adding a new tax form means appending one entry to `DocumentRegistry` —
 * no UI changes are required. The intake panel reads `category` and `fields`
 * to drive a categorized dropdown and a dynamically-rendered form.
 *
 * Scope boundary for `validate()` (audited Phase 1.7 — keep this true for
 * every future entry too): a document's `validate()` may only assert
 *   (a) objective facts about that document (a value is missing/expired/
 *       nonzero/overdue), and
 *   (b) heuristic, provider/lender-agnostic risk indicators (e.g. a
 *       generic "high revolving utilization" or "low contingency" flag with
 *       no institution attached).
 * It must NOT assert a specific lender's, insurer's, or program's published
 * guideline as a pass/fail conclusion (e.g. "this score qualifies for B
 * lending," "this exceeds CMHC's limit") — those thresholds vary by
 * institution, change over time, and are the explicit responsibility of the
 * future Lender/Policy & Recommendation Engine (docs/ROADMAP.md). Where a
 * finding is genuinely policy-adjacent, phrase it as deferring to "lender
 * policy" / "lender overlay" rather than asserting the threshold yourself —
 * see BUSINESS_LICENCE, BONUS_LETTER, ASSIGNMENT_AGREEMENT, INSOLVENCY_RECORD
 * for the pattern. Cross-document rules (src/utils/crossDocumentValidation.ts)
 * follow the same boundary.
 */

// ────────────────────────────────────────────────────────────────────────────────
// Taxonomy
// ────────────────────────────────────────────────────────────────────────────────

export type DocumentKind =
  // Core Returns
  | "T1"
  | "T2"
  | "T3_RET"
  | "T5013_RET"
  | "NOA"
  // T4 Family
  | "T4"
  | "T4A"
  | "T4A_OAS"
  | "T4A_P"
  | "T4E"
  | "T4FHSA"
  | "T4RIF"
  | "T4RSP"
  | "T4A_RCA"
  // Investments
  | "T5"
  | "T3"
  | "T5008"
  | "T5013"
  // Specialized
  | "T5007"
  | "T2202"
  | "T10"
  | "T101"
  | "T1204"
  | "T5006"
  // Sub-schedules (kept for backwards compatibility w/ Tax Slip Suite)
  | "T2_SCH1"
  | "T2_SCH100"
  | "T2_SCH125"
  | "T2125"
  // Super-Priority Sources
  | "PD7A"
  | "RC59"
  | "NET34"
  // ── Comprehensive residential underwriting expansion (see banner comments
  //    below in DocumentRegistry for merge rationale on each group) ──
  // Identity
  | "GOVT_ID"
  // Legal
  | "POA"
  | "PROPERTY_DEED"
  | "LIEN_WRIT_DOCUMENTATION"
  | "ILA_CERTIFICATE"
  // Corporate
  | "ARTICLES_OF_INCORPORATION"
  | "CORP_PROFILE_REPORT"
  | "CORP_FINANCIAL_STATEMENTS"
  | "BUSINESS_LICENCE"
  | "BUSINESS_BANK_STATEMENT"
  // Income
  | "LETTER_OF_EMPLOYMENT"
  | "EMPLOYMENT_CONTRACT"
  | "PAY_STUB"
  | "COMMISSION_STATEMENT"
  | "BONUS_LETTER"
  | "PROFESSIONAL_LICENCE"
  // Assets
  | "PERSONAL_BANK_STATEMENT"
  | "INVESTMENT_STATEMENT"
  | "REGISTERED_ACCOUNT_STATEMENT"
  | "CRYPTO_STATEMENT"
  | "FOREIGN_ASSET_STATEMENT"
  | "GIFT_LETTER"
  | "LARGE_DEPOSIT_DOCUMENTATION"
  // Property
  | "AGREEMENT_OF_PURCHASE_SALE"
  | "BUILDER_PURCHASE_AGREEMENT"
  | "ASSIGNMENT_AGREEMENT"
  | "MLS_LISTING"
  | "APPRAISAL_REPORT"
  | "CONDO_STATUS_CERTIFICATE"
  | "PROPERTY_TAX_STATEMENT"
  | "HOME_INSURANCE_BINDER"
  | "TITLE_INSURANCE"
  | "SURVEY_PLAN"
  // Liabilities
  | "MORTGAGE_STATEMENT"
  | "HELOC_STATEMENT"
  | "DEBT_ACCOUNT_STATEMENT"
  | "CRA_REQUIREMENT_TO_PAY"
  // Credit
  | "CREDIT_BUREAU_REPORT"
  | "INSOLVENCY_RECORD"
  // Rental
  | "LEASE_AGREEMENT"
  | "RENT_ROLL"
  | "PROPERTY_MANAGEMENT_AGREEMENT"
  | "T776"
  // Specialized Lending
  | "CONSTRUCTION_BUDGET"
  | "BUILDING_PERMIT"
  | "NEW_HOME_WARRANTY"
  | "BLUEPRINTS"
  | "REVERSE_MORTGAGE_DISCLOSURE"
  | "EXIT_STRATEGY_LETTER"
  // Broker Workflow
  | "BROKER_NOTES"
  | "MORTGAGE_COMMITMENT_LETTER"
  | "MORTGAGE_RENEWAL_OFFER"
  | "EXISTING_APPROVAL_LETTER"
  | "LENDER_CONDITIONS_LETTER";

export type DocumentCategory =
  | "Core Returns"
  | "T4 Family"
  | "Investments"
  | "Specialized"
  | "Sub-Schedules"
  | "Super-Priority"
  // Comprehensive residential underwriting expansion. "Specialized Lending" is
  // deliberately a distinct string from the pre-existing "Specialized" (CRA
  // specialized tax slips) — the two are unrelated document sets and must not
  // collide in CATEGORY_ORDER/getRegistryByCategory.
  | "Identity"
  | "Legal"
  | "Corporate"
  | "Income"
  | "Assets"
  | "Property"
  | "Liabilities"
  | "Credit"
  | "Rental"
  | "Specialized Lending"
  | "Broker Workflow";

export type ComplianceSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export interface ComplianceAlert {
  code: string;
  label: string;
  severity: ComplianceSeverity;
  detail: string;
  sourceDoc: DocumentKind;
  penaltyPoints: number;
  superPriority?: boolean;
}

export interface ExtractedFields {
  [key: string]: number | string | boolean | null | undefined;
}

export interface RawDocument {
  kind: DocumentKind;
  payload: Record<string, unknown>;
  applicantId?: string;
  source?: string;
}

export interface ProcessedDocument {
  kind: DocumentKind;
  applicantId?: string;
  source?: string;
  extracted: ExtractedFields;
  alerts: ComplianceAlert[];
}

/** UI metadata so the intake form can be rendered generically. */
export type FieldType = "text" | "number" | "boolean";
export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  sample?: string | number | boolean;
  /** Short, human-readable — rendered in ComplianceIntakePanel under the field (e.g. an enum list). Also reaches the AI prompt. */
  hint?: string;
  /** AI-extraction guidance only (e.g. how to handle an edge case in the source document) — reaches promptBuilder.ts but is never rendered in the UI. Keep human-facing "valid values" guidance in `hint` instead. */
  aiHint?: string;
}

interface RegistryEntry {
  kind: DocumentKind;
  label: string;
  category: DocumentCategory;
  /**
   * Underwriting purpose this document serves (e.g. "KYC", "Income
   * Verification", "Debt Verification"). Optional so the original 31
   * CRA-form entries above (which predate this field) don't require a
   * mechanical backfill edit; every new entry added below sets it.
   */
  purpose?: string;
  fields: FieldSpec[];
  extract: (payload: Record<string, unknown>) => ExtractedFields;
  validate: (extracted: ExtractedFields) => ComplianceAlert[];
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const bool = (v: unknown): boolean => v === true || v === "true" || (typeof v === "number" && v !== 0);

const fmt = (n: number): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);

// Common reusable field specs
const F = {
  taxpayer: { name: "taxpayerName", label: "Taxpayer Name", type: "text" as const, sample: "Mujeeb Minhas" },
  taxYear: { name: "taxYear", label: "Tax Year", type: "number" as const, sample: 2024 },
  payer: { name: "payerName", label: "Payer Name", type: "text" as const, sample: "Crown Holdings" },
  bn: { name: "businessNumber", label: "Business Number", type: "text" as const, sample: "123456789RC0001" },
};

const arrearsFlag = (
  kind: DocumentKind,
  amount: number,
  code: string,
  label: string,
  sev: ComplianceSeverity,
  pts: number,
  superPriority?: boolean,
): ComplianceAlert[] =>
  amount > 0
    ? [{
        code,
        label,
        severity: sev,
        detail: `${fmt(amount)} outstanding on ${kind}.`,
        sourceDoc: kind,
        penaltyPoints: pts,
        ...(superPriority ? { superPriority } : {}),
      }]
    : [];

// Days between now and a field's date string; null if missing/unparseable.
// Used for expiry-driven checks (ID documents, permits, licences, commitment
// letters) across the comprehensive underwriting expansion below.
const daysUntil = (dateStr: unknown): number | null => {
  const s = str(dateStr);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
};

// Shared base shape for MORTGAGE_STATEMENT / HELOC_STATEMENT /
// DEBT_ACCOUNT_STATEMENT (Phase 1.7 debt-document architecture review) — the
// "shared base model" the three specialized kinds build on, so the common
// institution/balance/payment/rate/status shape is defined exactly once.
const DEBT_BASE_FIELDS: FieldSpec[] = [
  { name: "institutionName", label: "Financial Institution", type: "text", sample: "TD Canada Trust" },
  { name: "accountNumber", label: "Account Number", type: "text", sample: "****5502" },
  { name: "currentBalance", label: "Current Balance", type: "number", sample: 18500 },
  { name: "monthlyPayment", label: "Monthly Payment", type: "number", sample: 450 },
  { name: "interestRate", label: "Interest Rate (%)", type: "number", sample: 6.5 },
  { name: "accountStatus", label: "Account Status", type: "text", sample: "Current", hint: "Current | Arrears" },
];

const extractDebtBase = (p: Record<string, unknown>): ExtractedFields => ({
  institutionName: str(p.institutionName ?? p.institution_name),
  accountNumber: str(p.accountNumber ?? p.account_number),
  currentBalance: num(p.currentBalance ?? p.current_balance),
  monthlyPayment: num(p.monthlyPayment ?? p.monthly_payment),
  interestRate: num(p.interestRate ?? p.interest_rate),
  accountStatus: str(p.accountStatus ?? p.account_status),
});

// ────────────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────────────

export const DocumentRegistry: Record<DocumentKind, RegistryEntry> = {
  // ════════════ CORE RETURNS ════════════
  T1: {
    kind: "T1",
    label: "T1 Personal Income Tax Return",
    category: "Core Returns",
    fields: [
      F.taxpayer,
      F.taxYear,
      { name: "line_13500", label: "Line 13500 — Net Business Income", type: "number", sample: 62000 },
      { name: "line_15000", label: "Line 15000 — Total Income", type: "number", sample: 124500 },
      { name: "line_23600", label: "Line 23600 — Net Income", type: "number", sample: 118000 },
    ],
    extract: (p) => ({
      taxpayerName: str(p.taxpayerName ?? p.taxpayer_name),
      taxYear: num(p.taxYear ?? p.tax_year),
      line_13500_net_biz_income: num(p.line13500 ?? p.line_13500),
      line_15000_total_income: num(p.line15000 ?? p.line_15000),
      line_23600_net_income: num(p.line23600 ?? p.line_23600),
    }),
    validate: () => [],
  },
  T2: {
    kind: "T2",
    label: "T2 Corporation Income Tax Return",
    category: "Core Returns",
    fields: [
      { name: "corporationName", label: "Corporation Name", type: "text", sample: "Acme Holdings Ltd." },
      F.taxYear,
      F.bn,
    ],
    extract: (p) => ({
      corporationName: str(p.corporationName ?? p.corporation_name),
      taxYear: num(p.taxYear ?? p.tax_year),
      businessNumber: str(p.businessNumber ?? p.business_number),
    }),
    validate: () => [],
  },
  T3_RET: {
    kind: "T3_RET",
    label: "T3 RET — Trust Income Tax & Information Return",
    category: "Core Returns",
    fields: [
      { name: "trustName", label: "Trust Name", type: "text", sample: "Minhas Family Trust" },
      { name: "trustAccount", label: "Trust Account Number", type: "text", sample: "T12345678" },
      F.taxYear,
      { name: "totalTrustIncome", label: "Total Trust Income", type: "number", sample: 48200 },
      { name: "balance_owing", label: "Balance Owing", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      trustName: str(p.trustName),
      trustAccount: str(p.trustAccount),
      taxYear: num(p.taxYear),
      totalTrustIncome: num(p.totalTrustIncome),
      balance_owing: num(p.balance_owing),
    }),
    validate: (e) => arrearsFlag("T3_RET", num(e.balance_owing), "TRUST-BALANCE-OWING", "Trust return balance owing to CRA", "HIGH", 15),
  },
  T5013_RET: {
    kind: "T5013_RET",
    label: "T5013 RET — Partnership Information Return",
    category: "Core Returns",
    fields: [
      { name: "partnershipName", label: "Partnership Name", type: "text", sample: "Minhas Partners LP" },
      { name: "partnershipAccount", label: "Partnership Account", type: "text", sample: "P-2245-789" },
      F.taxYear,
      { name: "totalPartnershipIncome", label: "Total Partnership Income", type: "number", sample: 220000 },
    ],
    extract: (p) => ({
      partnershipName: str(p.partnershipName),
      partnershipAccount: str(p.partnershipAccount),
      taxYear: num(p.taxYear),
      totalPartnershipIncome: num(p.totalPartnershipIncome),
    }),
    validate: (e) =>
      str(e.partnershipAccount)
        ? []
        : [{
            code: "PART-RET-MISSING-ACCT",
            label: "T5013 RET missing partnership account",
            severity: "WARNING",
            detail: "Partnership CRA registration cannot be verified.",
            sourceDoc: "T5013_RET",
            penaltyPoints: 5,
          }],
  },
  NOA: {
    kind: "NOA",
    label: "CRA Notice of Assessment",
    category: "Core Returns",
    fields: [
      F.taxpayer,
      F.taxYear,
      { name: "line_15000_total_income", label: "Line 15000 — Total Income", type: "number", sample: 124500 },
      { name: "line_23600_net_income", label: "Line 23600 — Net Income", type: "number", sample: 118000 },
      { name: "balance_owing_at_assessment", label: "Balance Owing", type: "number", sample: 4250 },
      { name: "has_unarranged_arrears", label: "Unarranged Arrears Flagged", type: "boolean", sample: true },
    ],
    extract: (p) => ({
      taxpayerName: str(p.taxpayer_name ?? p.taxpayerName),
      taxYear: num(p.tax_year ?? p.taxYear),
      line_15000_total_income: num(p.line_15000_total_income ?? p.line15000),
      line_23600_net_income: num(p.line_23600_net_income ?? p.line23600),
      balance_owing: num(p.balance_owing_at_assessment ?? p.balanceOwing ?? p.balance_owing),
      has_arrears: bool(p.has_unarranged_arrears ?? p.hasArrears ?? p.has_arrears),
    }),
    validate: (e) => {
      const owing = num(e.balance_owing);
      if (owing > 0 || bool(e.has_arrears)) {
        return [{
          code: "CRA-BALANCE-OWING",
          label: "CRA balance owing / tax liability on NOA",
          severity: "HIGH",
          detail: `NOA reports ${fmt(owing)} outstanding to CRA${bool(e.has_arrears) ? " (unarranged arrears flagged)" : ""}.`,
          sourceDoc: "NOA",
          penaltyPoints: 20,
        }];
      }
      return [];
    },
  },

  // ════════════ T4 FAMILY ════════════
  T4: {
    kind: "T4",
    label: "T4 — Statement of Remuneration Paid",
    category: "T4 Family",
    fields: [
      F.payer,
      F.taxYear,
      { name: "box_14_employment_income", label: "Box 14 — Employment Income", type: "number", sample: 95200 },
      { name: "box_22_income_tax_deducted", label: "Box 22 — Income Tax Deducted", type: "number", sample: 21500 },
      { name: "box_24_ei_insurable", label: "Box 24 — EI Insurable Earnings", type: "number", sample: 65700 },
      { name: "box_26_cpp_pensionable", label: "Box 26 — CPP Pensionable Earnings", type: "number", sample: 68500 },
    ],
    extract: (p) => ({
      payerName: str(p.payerName),
      taxYear: num(p.taxYear),
      box_14: num(p.box_14_employment_income ?? p.box14),
      box_22: num(p.box_22_income_tax_deducted ?? p.box22),
      box_24: num(p.box_24_ei_insurable ?? p.box24),
      box_26: num(p.box_26_cpp_pensionable ?? p.box26),
    }),
    validate: () => [],
  },
  T4A: {
    kind: "T4A",
    label: "T4A — Pension, Retirement, Annuity & Other Income",
    category: "T4 Family",
    fields: [
      F.payer,
      F.taxYear,
      { name: "box048", label: "Box 048 — Fees for Services", type: "number", sample: 24500 },
      { name: "box016", label: "Box 016 — Pension or Superannuation", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      payerName: str(p.payerName),
      taxYear: num(p.taxYear),
      box_048_fees_for_services: num(p.box048 ?? p.box_048),
      box_016_pension: num(p.box016 ?? p.box_016),
    }),
    validate: () => [],
  },
  T4A_OAS: {
    kind: "T4A_OAS",
    label: "T4A(OAS) — Old Age Security",
    category: "T4 Family",
    fields: [
      F.taxYear,
      { name: "box_18_gross_oas", label: "Box 18 — Gross OAS Pension", type: "number", sample: 8400 },
      { name: "box_22_income_tax_deducted", label: "Box 22 — Income Tax Deducted", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      box_18_gross_oas: num(p.box_18_gross_oas ?? p.box18),
      box_22_tax: num(p.box_22_income_tax_deducted ?? p.box22),
    }),
    validate: () => [],
  },
  T4A_P: {
    kind: "T4A_P",
    label: "T4A(P) — CPP Benefits",
    category: "T4 Family",
    fields: [
      F.taxYear,
      { name: "box_20_taxable_cpp", label: "Box 20 — Taxable CPP Benefits", type: "number", sample: 14200 },
      { name: "box_22_income_tax_deducted", label: "Box 22 — Income Tax Deducted", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      box_20_taxable_cpp: num(p.box_20_taxable_cpp ?? p.box20),
      box_22_tax: num(p.box_22_income_tax_deducted ?? p.box22),
    }),
    validate: () => [],
  },
  T4E: {
    kind: "T4E",
    label: "T4E — Statement of Employment Insurance Benefits",
    category: "T4 Family",
    fields: [
      F.taxYear,
      { name: "box_14_total_benefits", label: "Box 14 — Total EI Benefits Paid", type: "number", sample: 12800 },
      { name: "box_30_repayment", label: "Box 30 — Total Repayment", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      box_14_benefits: num(p.box_14_total_benefits ?? p.box14),
      box_30_repayment: num(p.box_30_repayment ?? p.box30),
    }),
    validate: (e) => {
      const benefits = num(e.box_14_benefits);
      return benefits > 0
        ? [{
            code: "EMP-EI-CLAIM-HISTORY",
            label: "EI benefits drawn in tax year — verify employment continuity",
            severity: "WARNING",
            detail: `${fmt(benefits)} EI benefits reported on T4E.`,
            sourceDoc: "T4E",
            penaltyPoints: 5,
          }]
        : [];
    },
  },
  T4FHSA: {
    kind: "T4FHSA",
    label: "T4FHSA — First Home Savings Account",
    category: "T4 Family",
    fields: [
      F.taxYear,
      { name: "box_18_contributions", label: "Box 18 — FHSA Contributions", type: "number", sample: 8000 },
      { name: "box_22_taxable_withdrawals", label: "Box 22 — Taxable Withdrawals", type: "number", sample: 0 },
      { name: "box_24_qualifying_withdrawals", label: "Box 24 — Qualifying Withdrawals", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      contributions: num(p.box_18_contributions ?? p.box18),
      taxableWithdrawals: num(p.box_22_taxable_withdrawals ?? p.box22),
      qualifyingWithdrawals: num(p.box_24_qualifying_withdrawals ?? p.box24),
    }),
    validate: () => [],
  },
  T4RIF: {
    kind: "T4RIF",
    label: "T4RIF — Income from a RRIF",
    category: "T4 Family",
    fields: [
      F.taxYear,
      { name: "box_16_taxable_amounts", label: "Box 16 — Taxable Amounts", type: "number", sample: 18500 },
      { name: "box_28_income_tax_deducted", label: "Box 28 — Income Tax Deducted", type: "number", sample: 1800 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      box_16: num(p.box_16_taxable_amounts ?? p.box16),
      box_28: num(p.box_28_income_tax_deducted ?? p.box28),
    }),
    validate: () => [],
  },
  T4RSP: {
    kind: "T4RSP",
    label: "T4RSP — Statement of RRSP Income",
    category: "T4 Family",
    fields: [
      F.taxYear,
      { name: "box_22_withdrawals", label: "Box 22 — Withdrawals & Commutation", type: "number", sample: 12000 },
      { name: "box_30_income_tax_deducted", label: "Box 30 — Income Tax Deducted", type: "number", sample: 2400 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      withdrawals: num(p.box_22_withdrawals ?? p.box22),
      tax: num(p.box_30_income_tax_deducted ?? p.box30),
    }),
    validate: (e) => {
      const w = num(e.withdrawals);
      return w > 25000
        ? [{
            code: "RRSP-LARGE-WITHDRAWAL",
            label: "Large RRSP withdrawal — verify source of down payment",
            severity: "WARNING",
            detail: `${fmt(w)} drawn from RRSP. Confirm under HBP/LLP vs taxable.`,
            sourceDoc: "T4RSP",
            penaltyPoints: 5,
          }]
        : [];
    },
  },
  T4A_RCA: {
    kind: "T4A_RCA",
    label: "T4A-RCA — Retirement Compensation Arrangement",
    category: "T4 Family",
    fields: [
      F.taxYear,
      { name: "box_17_distributions", label: "Box 17 — RCA Distributions", type: "number", sample: 0 },
      { name: "box_20_income_tax_deducted", label: "Box 20 — Income Tax Deducted", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      distributions: num(p.box_17_distributions ?? p.box17),
      tax: num(p.box_20_income_tax_deducted ?? p.box20),
    }),
    validate: () => [],
  },

  // ════════════ INVESTMENTS ════════════
  T5: {
    kind: "T5",
    label: "T5 — Statement of Investment Income",
    category: "Investments",
    fields: [
      F.payer,
      F.taxYear,
      { name: "box_10_actual_eligible_div", label: "Box 10 — Actual Eligible Dividends", type: "number", sample: 4200 },
      { name: "box_13_interest", label: "Box 13 — Interest from Canadian Sources", type: "number", sample: 1800 },
      { name: "box_24_actual_other_div", label: "Box 24 — Actual Other Dividends", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      payerName: str(p.payerName),
      taxYear: num(p.taxYear),
      eligibleDividends: num(p.box_10_actual_eligible_div ?? p.box10),
      interestIncome: num(p.box_13_interest ?? p.box13),
      otherDividends: num(p.box_24_actual_other_div ?? p.box24),
    }),
    validate: () => [],
  },
  T3: {
    kind: "T3",
    label: "T3 — Statement of Trust Income Allocations",
    category: "Investments",
    fields: [
      { name: "trustName", label: "Trust Name", type: "text", sample: "RBC Mutual Fund Trust" },
      F.taxYear,
      { name: "box_26_other_income", label: "Box 26 — Other Income", type: "number", sample: 2200 },
      { name: "box_49_actual_eligible_div", label: "Box 49 — Actual Eligible Dividends", type: "number", sample: 1100 },
      { name: "box_21_capital_gains", label: "Box 21 — Capital Gains", type: "number", sample: 3400 },
    ],
    extract: (p) => ({
      trustName: str(p.trustName),
      taxYear: num(p.taxYear),
      otherIncome: num(p.box_26_other_income ?? p.box26),
      eligibleDividends: num(p.box_49_actual_eligible_div ?? p.box49),
      capitalGains: num(p.box_21_capital_gains ?? p.box21),
    }),
    validate: () => [],
  },
  T5008: {
    kind: "T5008",
    label: "T5008 — Statement of Securities Transactions",
    category: "Investments",
    fields: [
      F.taxYear,
      { name: "box_20_cost_or_book_value", label: "Box 20 — Cost / Book Value (ACB)", type: "number", sample: 42000 },
      { name: "box_21_proceeds_of_disposition", label: "Box 21 — Proceeds of Disposition", type: "number", sample: 51500 },
      { name: "box_15_security_type", label: "Box 15 — Type Code", type: "text", sample: "SHS" },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      acb: num(p.box_20_cost_or_book_value ?? p.box20),
      proceeds: num(p.box_21_proceeds_of_disposition ?? p.box21),
      securityType: str(p.box_15_security_type ?? p.box15),
    }),
    validate: () => [],
  },
  T5013: {
    kind: "T5013",
    label: "T5013 — Partnership Income Slip",
    category: "Investments",
    fields: [
      { name: "box010", label: "Box 010 — Partnership Account", type: "text", sample: "P-2245-789" },
      { name: "box020", label: "Box 020 — Total Partnership Units", type: "number", sample: 100 },
      { name: "box116", label: "Box 116 — Partner Share — Business Income", type: "number", sample: 48500 },
      { name: "box122", label: "Box 122 — Partner Share — Rental Income", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      box_010_partnership_acct: str(p.box010 ?? p.box_010),
      box_020_total_units: num(p.box020 ?? p.box_020),
      box_116_partner_share_business: num(p.box116 ?? p.box_116),
      box_122_partner_share_rental: num(p.box122 ?? p.box_122),
    }),
    validate: (e) =>
      str(e.box_010_partnership_acct)
        ? []
        : [{
            code: "PART-MISSING-REGISTRATION",
            label: "T5013 missing partnership account number (Box 010)",
            severity: "WARNING",
            detail: "Cannot verify CRA registration of the partnership.",
            sourceDoc: "T5013",
            penaltyPoints: 5,
          }],
  },

  // ════════════ SPECIALIZED ════════════
  T5007: {
    kind: "T5007",
    label: "T5007 — Statement of Benefits (Social Assistance / WCB)",
    category: "Specialized",
    fields: [
      F.taxYear,
      { name: "box_10_wcb_payments", label: "Box 10 — WCB Payments", type: "number", sample: 0 },
      { name: "box_11_social_assistance", label: "Box 11 — Social Assistance Payments", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      wcb: num(p.box_10_wcb_payments ?? p.box10),
      socialAssistance: num(p.box_11_social_assistance ?? p.box11),
    }),
    validate: (e) => {
      const sa = num(e.socialAssistance);
      const wcb = num(e.wcb);
      const total = sa + wcb;
      return total > 0
        ? [{
            code: "INCOME-NON-QUALIFYING-T5007",
            label: "Income source is social assistance / WCB",
            severity: "WARNING",
            detail: `${fmt(total)} reported on T5007 — typically excluded from A-lender qualifying income.`,
            sourceDoc: "T5007",
            penaltyPoints: 10,
          }]
        : [];
    },
  },
  T2202: {
    kind: "T2202",
    label: "T2202 — Tuition & Enrolment Certificate",
    category: "Specialized",
    fields: [
      { name: "institutionName", label: "Institution Name", type: "text", sample: "University of Toronto" },
      F.taxYear,
      { name: "totalEligibleTuition", label: "Eligible Tuition Fees", type: "number", sample: 7800 },
      { name: "months_full_time", label: "Full-Time Months", type: "number", sample: 8 },
      { name: "months_part_time", label: "Part-Time Months", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      institutionName: str(p.institutionName),
      taxYear: num(p.taxYear),
      tuition: num(p.totalEligibleTuition),
      monthsFullTime: num(p.months_full_time),
      monthsPartTime: num(p.months_part_time),
    }),
    validate: () => [],
  },
  T10: {
    kind: "T10",
    label: "T10 — Pension Adjustment Reversal",
    category: "Specialized",
    fields: [
      F.taxYear,
      { name: "box_2_par_amount", label: "Box 2 — PAR Amount", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      par: num(p.box_2_par_amount ?? p.box2),
    }),
    validate: () => [],
  },
  T101: {
    kind: "T101",
    label: "T101 — Statement of Resource Expenses (Flow-Through Shares)",
    category: "Specialized",
    fields: [
      F.taxYear,
      { name: "box_120_cee", label: "Box 120 — CEE Renounced", type: "number", sample: 0 },
      { name: "box_121_cde", label: "Box 121 — CDE Renounced", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      cee: num(p.box_120_cee ?? p.box120),
      cde: num(p.box_121_cde ?? p.box121),
    }),
    validate: () => [],
  },
  T1204: {
    kind: "T1204",
    label: "T1204 — Government Service Contract Payments",
    category: "Specialized",
    fields: [
      F.taxYear,
      { name: "box82", label: "Box 82 — Services Portion", type: "number", sample: 38000 },
      { name: "box84", label: "Box 84 — Total Payments", type: "number", sample: 42000 },
    ],
    extract: (p) => ({
      box_82_service_payments: num(p.box82 ?? p.box_82),
      box_84_total_payments: num(p.box84 ?? p.box_84),
    }),
    validate: () => [],
  },
  T5006: {
    kind: "T5006",
    label: "T5006 — Registered LSVCC Investment",
    category: "Specialized",
    fields: [
      F.taxYear,
      { name: "box_1_cost_of_shares", label: "Box 1 — Cost of Shares", type: "number", sample: 5000 },
      { name: "box_2_federal_credit", label: "Box 2 — Federal Tax Credit", type: "number", sample: 750 },
    ],
    extract: (p) => ({
      taxYear: num(p.taxYear),
      costOfShares: num(p.box_1_cost_of_shares ?? p.box1),
      federalCredit: num(p.box_2_federal_credit ?? p.box2),
    }),
    validate: () => [],
  },

  // ════════════ SUB-SCHEDULES (legacy/back-compat) ════════════
  T2_SCH1: {
    kind: "T2_SCH1",
    label: "T2 Schedule 1 — Net Income (Loss) for Tax Purposes",
    category: "Sub-Schedules",
    fields: [{ name: "line_9999", label: "Line 9999 — Net Income for Tax", type: "number", sample: 84200 }],
    extract: (p) => ({ netIncomeForTax: num(p.netIncomeForTax ?? p.line_9999) }),
    validate: () => [],
  },
  T2_SCH100: {
    kind: "T2_SCH100",
    label: "T2 Schedule 100 — Balance Sheet (GIFI)",
    category: "Sub-Schedules",
    fields: [
      { name: "field_2599", label: "GIFI 2599 — Total Assets", type: "number", sample: 2_450_000 },
      { name: "field_3499", label: "GIFI 3499 — Total Liabilities", type: "number", sample: 1_980_000 },
    ],
    extract: (p) => ({
      field_2599_total_assets: num(p.field_2599 ?? p.totalAssets),
      field_3499_total_liabilities: num(p.field_3499 ?? p.totalLiabilities),
    }),
    validate: (e) => {
      const assets = num(e.field_2599_total_assets);
      const liab = num(e.field_3499_total_liabilities);
      if (liab > assets && assets > 0) {
        return [{
          code: "CORP-BALANCE-SHEET-INSOLVENT",
          label: "Total liabilities exceed total assets (GIFI 3499 > 2599)",
          severity: "HIGH",
          detail: `Assets ${fmt(assets)} vs Liabilities ${fmt(liab)} — technical insolvency.`,
          sourceDoc: "T2_SCH100",
          penaltyPoints: 20,
        }];
      }
      return [];
    },
  },
  T2_SCH125: {
    kind: "T2_SCH125",
    label: "T2 Schedule 125 — Income Statement (GIFI)",
    category: "Sub-Schedules",
    fields: [
      { name: "field_8299", label: "GIFI 8299 — Total Revenue", type: "number", sample: 1_850_000 },
      { name: "field_9369", label: "GIFI 9369 — Net Income Before Tax", type: "number", sample: 84200 },
    ],
    extract: (p) => ({
      field_8299_total_revenue: num(p.field_8299 ?? p.totalRevenue),
      field_9369_net_income: num(p.field_9369 ?? p.netIncomeBeforeTax),
    }),
    validate: (e) =>
      num(e.field_9369_net_income) < 0
        ? [{
            code: "CORP-NET-LOSS",
            label: "Operating company reported a net loss (GIFI 9369 < 0)",
            severity: "WARNING",
            detail: `Net income before tax = ${fmt(num(e.field_9369_net_income))}.`,
            sourceDoc: "T2_SCH125",
            penaltyPoints: 5,
          }]
        : [],
  },
  T2125: {
    kind: "T2125",
    label: "T2125 — Statement of Business / Professional Activities",
    category: "Sub-Schedules",
    fields: [
      { name: "businessName", label: "Business Name", type: "text", sample: "Minhas Consulting" },
      { name: "part1Gross", label: "Part 1 — Gross Business Income", type: "number", sample: 180000 },
      { name: "part5Net", label: "Part 5 — Net Income After Adjustments", type: "number", sample: 62000 },
    ],
    extract: (p) => ({
      businessName: str(p.businessName ?? p.business_name),
      part1_gross: num(p.part1Gross ?? p.part_1_gross),
      part5_net: num(p.part5Net ?? p.part_5_net),
    }),
    validate: (e) => {
      const gross = num(e.part1_gross);
      const net = num(e.part5_net);
      if (gross > 0 && net / gross > 0.95) {
        return [{
          code: "SOLE-PROP-MARGIN-OUTLIER",
          label: "Reported margin >95% on T2125 — verify expense capture",
          severity: "WARNING",
          detail: `Part 5 net ${fmt(net)} on Part 1 gross ${fmt(gross)}.`,
          sourceDoc: "T2125",
          penaltyPoints: 5,
        }];
      }
      return [];
    },
  },

  // ════════════ SUPER-PRIORITY ════════════
  PD7A: {
    kind: "PD7A",
    label: "PD7A — Source Deductions Statement of Account",
    category: "Super-Priority",
    fields: [
      { name: "payrollAccount", label: "Payroll Account Number", type: "text", sample: "123456789RP0001" },
      { name: "outstandingDeductions", label: "Outstanding Source Deductions", type: "number", sample: 12450 },
      { name: "period", label: "Reporting Period", type: "text", sample: "2025-04" },
    ],
    extract: (p) => ({
      payrollAccount: str(p.payrollAccount ?? p.account_number),
      outstanding_deductions: num(p.outstandingDeductions ?? p.amount_owing ?? p.balance),
      reporting_period: str(p.period ?? p.reporting_period),
    }),
    validate: (e) => {
      const arrears = num(e.outstanding_deductions);
      return arrears > 0
        ? [{
            code: "HIGH_RISK_LIEN_ALERT",
            label: "Unremitted CRA payroll source deductions (PD7A)",
            severity: "HIGH",
            detail: `PD7A shows ${fmt(arrears)} in outstanding source deductions. Statutory super-priority Crown lien risk — ranks ahead of mortgage security.`,
            sourceDoc: "PD7A",
            penaltyPoints: 30,
            superPriority: true,
          }]
        : [];
    },
  },
  RC59: {
    kind: "RC59",
    label: "RC59 — Business Consent / Authorization (payroll arrears)",
    category: "Super-Priority",
    fields: [
      { name: "businessNumber", label: "Business Number", type: "text", sample: "123456789" },
      { name: "outstandingDeductions", label: "Outstanding Deductions", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      businessNumber: str(p.businessNumber ?? p.bn),
      outstanding_deductions: num(p.outstandingDeductions ?? p.amount_owing ?? p.balance),
    }),
    validate: (e) => {
      const arrears = num(e.outstanding_deductions);
      return arrears > 0
        ? [{
            code: "HIGH_RISK_LIEN_ALERT",
            label: "Outstanding payroll deductions disclosed via RC59 inquiry",
            severity: "HIGH",
            detail: `RC59 inquiry returned ${fmt(arrears)} owing on payroll account. Crown super-priority exposure.`,
            sourceDoc: "RC59",
            penaltyPoints: 30,
            superPriority: true,
          }]
        : [];
    },
  },
  NET34: {
    kind: "NET34",
    label: "NET34 — GST/HST NETFILE Return",
    category: "Super-Priority",
    fields: [
      { name: "businessNumber", label: "Business Number", type: "text", sample: "123456789RT0001" },
      { name: "period", label: "Reporting Period", type: "text", sample: "2025-Q1" },
      { name: "netTaxOwing", label: "Net Tax Owing", type: "number", sample: 31200 },
      { name: "unremittedSalesTax", label: "Unremitted Sales Tax", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      businessNumber: str(p.businessNumber ?? p.bn),
      reporting_period: str(p.period ?? p.reporting_period),
      net_tax_owing: num(p.netTaxOwing ?? p.net_tax ?? p.amount_owing),
      unremitted_sales_tax: num(p.unremittedSalesTax ?? p.unremitted_sales_tax ?? p.balance),
    }),
    validate: (e) => {
      const unremitted = Math.max(num(e.unremitted_sales_tax), num(e.net_tax_owing));
      return unremitted > 0
        ? [{
            code: "CRITICAL_CROWN_CHARGE",
            label: "Unremitted GST/HST (deemed trust under ETA s.222)",
            severity: "CRITICAL",
            detail: `Net GST/HST owing of ${fmt(unremitted)} on NET34. Deemed-trust Crown charge — ranks ahead of conventional security. ABSOLUTE BLOCK on funding until cleared.`,
            sourceDoc: "NET34",
            penaltyPoints: 50,
            superPriority: true,
          }]
        : [];
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // COMPREHENSIVE RESIDENTIAL UNDERWRITING EXPANSION
  //
  // Canonical document TYPES, not underwriting checklist items or yearly
  // instances — chronology (tax year, statement/pay-period date) lives in
  // extracted fields, never in the registry key. Several proposed checklist
  // items were merged into one generalized kind with a discriminator field
  // (e.g. `idType`, `accountType`, `bureau`, `recordType`) rather than one
  // kind per variant; see the comment above each group below for the
  // specific merge rationale. Full reasoning also recorded in the chat
  // summary delivered alongside this change.
  // ════════════════════════════════════════════════════════════════════════

  // ────────── IDENTITY ──────────
  // Merges: Driver's Licence, Passport, Provincial Photo ID, Permanent
  // Resident Card, Work Permit, Study Permit, Citizenship Certificate.
  // All seven share an identical shape (holder name, DOB, ID/permit number,
  // issuing authority, issue/expiry date) and an identical primary
  // underwriting use — KYC identity verification — so a single kind with an
  // `idType` discriminator loses nothing: validate() still branches on
  // idType where treatment genuinely differs (temporary-status permits).
  GOVT_ID: {
    kind: "GOVT_ID",
    label: "Government-Issued Identity Document",
    category: "Identity",
    purpose: "KYC",
    fields: [
      { name: "idType", label: "ID Type", type: "text", sample: "Driver's Licence", hint: "Driver's Licence | Passport | Provincial Photo ID | Permanent Resident Card | Work Permit | Study Permit | Citizenship Certificate" },
      { name: "fullName", label: "Full Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "dateOfBirth", label: "Date of Birth", type: "text", sample: "1985-03-14" },
      { name: "idNumber", label: "ID / Permit Number", type: "text", sample: "M1234-56789-01234" },
      { name: "issuingAuthority", label: "Issuing Authority", type: "text", sample: "Ontario Ministry of Transportation" },
      { name: "countryOfIssue", label: "Country of Issue", type: "text", sample: "Canada" },
      { name: "issueDate", label: "Issue Date", type: "text", sample: "2022-05-14" },
      { name: "expiryDate", label: "Expiry Date", type: "text", sample: "2027-05-14" },
    ],
    extract: (p) => ({
      idType: str(p.idType ?? p.id_type),
      fullName: str(p.fullName ?? p.full_name ?? p.holderName),
      dateOfBirth: str(p.dateOfBirth ?? p.date_of_birth ?? p.dob),
      idNumber: str(p.idNumber ?? p.id_number),
      issuingAuthority: str(p.issuingAuthority ?? p.issuing_authority),
      countryOfIssue: str(p.countryOfIssue ?? p.country_of_issue ?? p.country),
      issueDate: str(p.issueDate ?? p.issue_date),
      expiryDate: str(p.expiryDate ?? p.expiry_date ?? p.expiration_date),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const days = daysUntil(e.expiryDate);
      if (days != null && days < 0) {
        alerts.push({
          code: "ID-EXPIRED",
          label: "Identity document expired",
          severity: "HIGH",
          detail: `${str(e.idType) || "Identity document"} expired ${Math.abs(days)} day(s) ago.`,
          sourceDoc: "GOVT_ID",
          penaltyPoints: 20,
        });
      } else if (days != null && days <= 90) {
        alerts.push({
          code: "ID-EXPIRING-SOON",
          label: "Identity document expiring within 90 days",
          severity: "WARNING",
          detail: `${str(e.idType) || "Identity document"} expires in ${days} day(s).`,
          sourceDoc: "GOVT_ID",
          penaltyPoints: 5,
        });
      }
      const idType = str(e.idType).toLowerCase();
      if (idType.includes("work permit") || idType.includes("study permit")) {
        alerts.push({
          code: "NON-PR-RESIDENCY-STATUS",
          label: "Temporary residency status disclosed",
          severity: "WARNING",
          detail: `Borrower holds a ${str(e.idType)} — confirm lender overlay for non-permanent-resident applicants.`,
          sourceDoc: "GOVT_ID",
          penaltyPoints: 5,
        });
      }
      return alerts;
    },
  },

  // ────────── LEGAL ──────────
  POA: {
    kind: "POA",
    label: "Power of Attorney",
    category: "Legal",
    purpose: "Ownership / Compliance",
    fields: [
      { name: "grantorName", label: "Grantor (Principal) Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "granteeName", label: "Attorney (Agent) Name", type: "text", sample: "Sana Minhas" },
      { name: "poaType", label: "POA Type", type: "text", sample: "General", hint: "General | Specific | Enduring" },
      { name: "effectiveDate", label: "Effective Date", type: "text", sample: "2025-01-10" },
      { name: "scope", label: "Scope / Powers Granted", type: "text", sample: "All real estate and financial matters" },
    ],
    extract: (p) => ({
      grantorName: str(p.grantorName ?? p.grantor_name),
      granteeName: str(p.granteeName ?? p.grantee_name ?? p.attorneyName),
      poaType: str(p.poaType ?? p.poa_type),
      effectiveDate: str(p.effectiveDate ?? p.effective_date),
      scope: str(p.scope),
    }),
    validate: (e) => {
      const scope = str(e.scope).toLowerCase();
      const isLimited = str(e.poaType).toLowerCase() === "specific";
      if (isLimited && scope && !scope.includes("real estate") && !scope.includes("mortgage") && !scope.includes("financial")) {
        return [{
          code: "POA-SCOPE-UNCONFIRMED",
          label: "Specific POA scope may not cover mortgage transaction",
          severity: "WARNING",
          detail: "POA is limited/specific — confirm the stated scope explicitly authorizes signing mortgage documents.",
          sourceDoc: "POA",
          penaltyPoints: 10,
        }];
      }
      return [];
    },
  },
  PROPERTY_DEED: {
    kind: "PROPERTY_DEED",
    label: "Property Deed / Transfer",
    category: "Legal",
    purpose: "Ownership / Compliance",
    fields: [
      { name: "registeredOwner", label: "Registered Owner(s)", type: "text", sample: "Mujeeb Minhas" },
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "registrationNumber", label: "Registration Number", type: "text", sample: "AT1234567" },
      { name: "registrationDate", label: "Registration Date", type: "text", sample: "2022-06-01" },
      { name: "instrumentType", label: "Instrument Type", type: "text", sample: "Transfer/Deed of Land" },
    ],
    extract: (p) => ({
      registeredOwner: str(p.registeredOwner ?? p.registered_owner),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      registrationNumber: str(p.registrationNumber ?? p.registration_number),
      registrationDate: str(p.registrationDate ?? p.registration_date),
      instrumentType: str(p.instrumentType ?? p.instrument_type),
    }),
    validate: () => [],
  },
  LIEN_WRIT_DOCUMENTATION: {
    kind: "LIEN_WRIT_DOCUMENTATION",
    label: "Lien / Writ Documentation",
    category: "Legal",
    purpose: "Ownership / Compliance",
    fields: [
      { name: "lienType", label: "Lien / Writ Type", type: "text", sample: "Construction Lien", hint: "Construction Lien | Writ of Seizure and Sale | Judgment" },
      { name: "amount", label: "Registered Amount", type: "number", sample: 18500 },
      { name: "registrationDate", label: "Registration Date", type: "text", sample: "2026-02-10" },
      { name: "creditorName", label: "Creditor / Claimant Name", type: "text", sample: "ABC Contracting Ltd." },
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
    ],
    extract: (p) => ({
      lienType: str(p.lienType ?? p.lien_type),
      amount: num(p.amount),
      registrationDate: str(p.registrationDate ?? p.registration_date),
      creditorName: str(p.creditorName ?? p.creditor_name),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
    }),
    validate: (e) =>
      arrearsFlag(
        "LIEN_WRIT_DOCUMENTATION",
        num(e.amount),
        "TITLE-LIEN-REGISTERED",
        "Registered lien/writ against title — must be discharged prior to funding",
        "HIGH",
        25,
        str(e.lienType).toLowerCase().includes("construction"),
      ),
  },
  ILA_CERTIFICATE: {
    kind: "ILA_CERTIFICATE",
    label: "Independent Legal Advice Certificate",
    category: "Legal",
    purpose: "Ownership / Compliance",
    fields: [
      { name: "clientName", label: "Client Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "lawyerName", label: "Lawyer Name", type: "text", sample: "Jordan Lee" },
      { name: "lawFirm", label: "Law Firm", type: "text", sample: "Lee & Associates LLP" },
      { name: "dateOfAdvice", label: "Date of Advice", type: "text", sample: "2026-03-01" },
      { name: "matterDescription", label: "Matter", type: "text", sample: "Guarantor obligations on mortgage" },
    ],
    extract: (p) => ({
      clientName: str(p.clientName ?? p.client_name),
      lawyerName: str(p.lawyerName ?? p.lawyer_name),
      lawFirm: str(p.lawFirm ?? p.law_firm),
      dateOfAdvice: str(p.dateOfAdvice ?? p.date_of_advice),
      matterDescription: str(p.matterDescription ?? p.matter_description),
    }),
    validate: () => [],
  },

  // ────────── CORPORATE ──────────
  ARTICLES_OF_INCORPORATION: {
    kind: "ARTICLES_OF_INCORPORATION",
    label: "Articles of Incorporation",
    category: "Corporate",
    purpose: "Self-Employed Income",
    fields: [
      { name: "corporationName", label: "Corporation Name", type: "text", sample: "Acme Holdings Ltd." },
      { name: "incorporationNumber", label: "Incorporation Number", type: "text", sample: "1234567" },
      { name: "jurisdiction", label: "Jurisdiction", type: "text", sample: "Ontario", hint: "Provincial jurisdiction or \"Federal\"" },
      { name: "incorporationDate", label: "Incorporation Date", type: "text", sample: "2018-04-12" },
    ],
    extract: (p) => ({
      corporationName: str(p.corporationName ?? p.corporation_name),
      incorporationNumber: str(p.incorporationNumber ?? p.incorporation_number),
      jurisdiction: str(p.jurisdiction),
      incorporationDate: str(p.incorporationDate ?? p.incorporation_date),
    }),
    validate: () => [],
  },
  CORP_PROFILE_REPORT: {
    kind: "CORP_PROFILE_REPORT",
    label: "Corporate Profile Report",
    category: "Corporate",
    purpose: "Self-Employed Income",
    fields: [
      { name: "corporationName", label: "Corporation Name", type: "text", sample: "Acme Holdings Ltd." },
      { name: "corporationStatus", label: "Corporation Status", type: "text", sample: "Active" },
      { name: "registeredOfficeAddress", label: "Registered Office Address", type: "text", sample: "100 King St W, Toronto, ON" },
      { name: "directors", label: "Directors", type: "text", sample: "Mujeeb Minhas" },
      { name: "lastAnnualReturnDate", label: "Last Annual Return Date", type: "text", sample: "2025-06-01" },
    ],
    extract: (p) => ({
      corporationName: str(p.corporationName ?? p.corporation_name),
      corporationStatus: str(p.corporationStatus ?? p.corporation_status ?? p.status),
      registeredOfficeAddress: str(p.registeredOfficeAddress ?? p.registered_office_address),
      directors: str(p.directors),
      lastAnnualReturnDate: str(p.lastAnnualReturnDate ?? p.last_annual_return_date),
    }),
    validate: (e) => {
      const status = str(e.corporationStatus).toLowerCase();
      if (status && status !== "active") {
        return [{
          code: "CORP-NOT-ACTIVE",
          label: "Corporation not in active/good standing",
          severity: "HIGH",
          detail: `Corporate profile report shows status "${str(e.corporationStatus)}" — verify before proceeding.`,
          sourceDoc: "CORP_PROFILE_REPORT",
          penaltyPoints: 20,
        }];
      }
      return [];
    },
  },
  CORP_FINANCIAL_STATEMENTS: {
    kind: "CORP_FINANCIAL_STATEMENTS",
    label: "Corporate Financial Statements",
    category: "Corporate",
    purpose: "Self-Employed Income",
    fields: [
      { name: "corporationName", label: "Corporation Name", type: "text", sample: "Acme Holdings Ltd." },
      { name: "fiscalYearEnd", label: "Fiscal Year End", type: "text", sample: "2025-12-31" },
      { name: "statementType", label: "Statement Type", type: "text", sample: "Notice to Reader", hint: "Audited | Review Engagement | Notice to Reader" },
      { name: "totalRevenue", label: "Total Revenue", type: "number", sample: 1_850_000 },
      { name: "netIncome", label: "Net Income", type: "number", sample: 84200 },
    ],
    extract: (p) => ({
      corporationName: str(p.corporationName ?? p.corporation_name),
      fiscalYearEnd: str(p.fiscalYearEnd ?? p.fiscal_year_end),
      statementType: str(p.statementType ?? p.statement_type),
      totalRevenue: num(p.totalRevenue ?? p.total_revenue),
      netIncome: num(p.netIncome ?? p.net_income),
    }),
    validate: (e) =>
      num(e.netIncome) < 0
        ? [{
            code: "CORP-FIN-STMT-NET-LOSS",
            label: "Corporate financial statements report a net loss",
            severity: "WARNING",
            detail: `Net income = ${fmt(num(e.netIncome))}.`,
            sourceDoc: "CORP_FINANCIAL_STATEMENTS",
            penaltyPoints: 5,
          }]
        : [],
  },
  BUSINESS_LICENCE: {
    kind: "BUSINESS_LICENCE",
    label: "Business Licence",
    category: "Corporate",
    purpose: "Self-Employed Income",
    fields: [
      { name: "businessName", label: "Business Name", type: "text", sample: "Minhas Consulting" },
      { name: "licenceNumber", label: "Licence Number", type: "text", sample: "BL-2025-4471" },
      { name: "issuingMunicipality", label: "Issuing Municipality", type: "text", sample: "City of Toronto" },
      { name: "issueDate", label: "Issue Date", type: "text", sample: "2025-01-01" },
      { name: "expiryDate", label: "Expiry Date", type: "text", sample: "2026-12-31" },
    ],
    extract: (p) => ({
      businessName: str(p.businessName ?? p.business_name),
      licenceNumber: str(p.licenceNumber ?? p.licence_number),
      issuingMunicipality: str(p.issuingMunicipality ?? p.issuing_municipality),
      issueDate: str(p.issueDate ?? p.issue_date),
      expiryDate: str(p.expiryDate ?? p.expiry_date),
    }),
    validate: (e) => {
      const days = daysUntil(e.expiryDate);
      return days != null && days < 0
        ? [{
            code: "BUSINESS-LICENCE-EXPIRED",
            label: "Business licence expired",
            severity: "WARNING",
            detail: `Licence expired ${Math.abs(days)} day(s) ago — confirm renewal.`,
            sourceDoc: "BUSINESS_LICENCE",
            penaltyPoints: 5,
          }]
        : [];
    },
  },
  // Down-payment/reserves (Personal Bank Statement) is a separate kind, below
  // under Assets — same statement shape, different underwriting purpose.
  BUSINESS_BANK_STATEMENT: {
    kind: "BUSINESS_BANK_STATEMENT",
    label: "Business Bank Statement",
    category: "Corporate",
    purpose: "Self-Employed Income",
    fields: [
      { name: "businessName", label: "Business Name", type: "text", sample: "Minhas Consulting" },
      { name: "institutionName", label: "Financial Institution", type: "text", sample: "RBC Royal Bank" },
      { name: "accountNumber", label: "Account Number", type: "text", sample: "****4821" },
      { name: "statementPeriodEnd", label: "Statement Period End", type: "text", sample: "2026-06-30", aiHint: "This upload may contain multiple monthly statements concatenated into one file — if so, use the END date of the LATEST (most recent) statement period, not the first one in the document" },
      { name: "openingBalance", label: "Opening Balance", type: "number", sample: 42000, aiHint: "If multiple monthly statements are concatenated into one file, use the opening balance of the EARLIEST statement period" },
      { name: "closingBalance", label: "Closing Balance", type: "number", sample: 51500, aiHint: "If multiple monthly statements are concatenated into one file, use the closing balance of the LATEST statement period, not the first one" },
      { name: "nsfCount", label: "NSF Count", type: "number", sample: 0, aiHint: "Scan every page/month in the document, not just the first — count every NSF, non-sufficient-funds, overdraft, or returned-item fee line item across the entire file" },
    ],
    extract: (p) => ({
      businessName: str(p.businessName ?? p.business_name),
      institutionName: str(p.institutionName ?? p.institution_name),
      accountNumber: str(p.accountNumber ?? p.account_number),
      statementPeriodEnd: str(p.statementPeriodEnd ?? p.statement_period_end),
      openingBalance: num(p.openingBalance ?? p.opening_balance),
      closingBalance: num(p.closingBalance ?? p.closing_balance),
      nsfCount: num(p.nsfCount ?? p.nsf_count),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const nsf = num(e.nsfCount);
      if (nsf > 0) {
        alerts.push({
          code: "BIZ-BANK-NSF",
          label: "NSF activity on business bank statement",
          severity: "WARNING",
          detail: `${nsf} NSF event(s) reported.`,
          sourceDoc: "BUSINESS_BANK_STATEMENT",
          penaltyPoints: 5 * Math.min(nsf, 3),
        });
      }
      if (num(e.closingBalance) < 0) {
        alerts.push({
          code: "BIZ-BANK-NEGATIVE-BALANCE",
          label: "Negative business account balance",
          severity: "HIGH",
          detail: `Closing balance = ${fmt(num(e.closingBalance))}.`,
          sourceDoc: "BUSINESS_BANK_STATEMENT",
          penaltyPoints: 15,
        });
      }
      return alerts;
    },
  },

  // ────────── INCOME ──────────
  LETTER_OF_EMPLOYMENT: {
    kind: "LETTER_OF_EMPLOYMENT",
    label: "Letter of Employment",
    category: "Income",
    purpose: "Income Verification",
    fields: [
      { name: "employerName", label: "Employer Name", type: "text", sample: "Crown Holdings" },
      { name: "employeeName", label: "Employee Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "position", label: "Position / Title", type: "text", sample: "Senior Analyst" },
      { name: "employmentStartDate", label: "Employment Start Date", type: "text", sample: "2021-09-01" },
      { name: "employmentStatus", label: "Employment Status", type: "text", sample: "Full-Time", hint: "Full-Time | Part-Time | Casual | Probationary" },
      { name: "annualSalary", label: "Annual Salary", type: "number", sample: 95000 },
      { name: "letterDate", label: "Letter Date", type: "text", sample: "2026-06-01" },
    ],
    extract: (p) => ({
      employerName: str(p.employerName ?? p.employer_name),
      employeeName: str(p.employeeName ?? p.employee_name),
      position: str(p.position),
      employmentStartDate: str(p.employmentStartDate ?? p.employment_start_date),
      employmentStatus: str(p.employmentStatus ?? p.employment_status),
      annualSalary: num(p.annualSalary ?? p.annual_salary),
      letterDate: str(p.letterDate ?? p.letter_date),
    }),
    validate: (e) =>
      str(e.employmentStatus).toLowerCase() === "probationary"
        ? [{
            code: "EMPLOYMENT-PROBATIONARY",
            label: "Borrower on probation",
            severity: "WARNING",
            detail: "Letter of employment discloses probationary status — confirm lender overlay for probationary employees.",
            sourceDoc: "LETTER_OF_EMPLOYMENT",
            penaltyPoints: 10,
          }]
        : [],
  },
  EMPLOYMENT_CONTRACT: {
    kind: "EMPLOYMENT_CONTRACT",
    label: "Employment Contract",
    category: "Income",
    purpose: "Income Verification",
    fields: [
      { name: "employerName", label: "Employer Name", type: "text", sample: "Crown Holdings" },
      { name: "employeeName", label: "Employee Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "position", label: "Position / Title", type: "text", sample: "Senior Analyst" },
      { name: "contractType", label: "Contract Type", type: "text", sample: "Permanent", hint: "Permanent | Fixed-Term | Contract" },
      { name: "contractEndDate", label: "Contract End Date (if fixed-term)", type: "text", sample: "" },
      { name: "baseSalary", label: "Base Salary", type: "number", sample: 95000 },
    ],
    extract: (p) => ({
      employerName: str(p.employerName ?? p.employer_name),
      employeeName: str(p.employeeName ?? p.employee_name),
      position: str(p.position),
      contractType: str(p.contractType ?? p.contract_type),
      contractEndDate: str(p.contractEndDate ?? p.contract_end_date),
      baseSalary: num(p.baseSalary ?? p.base_salary),
    }),
    validate: (e) => {
      const type = str(e.contractType).toLowerCase();
      const days = daysUntil(e.contractEndDate);
      if ((type === "fixed-term" || type === "contract") && days != null && days >= 0 && days < 365) {
        return [{
          code: "CONTRACT-EXPIRING-SOON",
          label: "Fixed-term contract expiring within 12 months",
          severity: "WARNING",
          detail: `Contract ends in ${days} day(s) — verify income continuity.`,
          sourceDoc: "EMPLOYMENT_CONTRACT",
          penaltyPoints: 10,
        }];
      }
      return [];
    },
  },
  // Chronology (pay period) is an extracted field, not the registry key —
  // one PAY_STUB kind, never "Pay Stub 1"/"Pay Stub 2".
  PAY_STUB: {
    kind: "PAY_STUB",
    label: "Pay Stub",
    category: "Income",
    purpose: "Income Verification",
    fields: [
      { name: "employerName", label: "Employer Name", type: "text", sample: "Crown Holdings" },
      { name: "employeeName", label: "Employee Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "payPeriodEndDate", label: "Pay Period End Date", type: "text", sample: "2026-06-15" },
      { name: "payFrequency", label: "Pay Frequency", type: "text", sample: "Biweekly", hint: "Weekly | Biweekly | Semi-Monthly | Monthly — needed to annualize gross pay for cross-document income checks" },
      { name: "grossPay", label: "Gross Pay (period)", type: "number", sample: 3800 },
      { name: "netPay", label: "Net Pay (period)", type: "number", sample: 2850 },
      { name: "ytdGross", label: "Year-to-Date Gross", type: "number", sample: 45600 },
    ],
    extract: (p) => ({
      employerName: str(p.employerName ?? p.employer_name),
      employeeName: str(p.employeeName ?? p.employee_name),
      payPeriodEndDate: str(p.payPeriodEndDate ?? p.pay_period_end_date),
      payFrequency: str(p.payFrequency ?? p.pay_frequency),
      grossPay: num(p.grossPay ?? p.gross_pay),
      netPay: num(p.netPay ?? p.net_pay),
      ytdGross: num(p.ytdGross ?? p.ytd_gross),
    }),
    validate: () => [],
  },
  COMMISSION_STATEMENT: {
    kind: "COMMISSION_STATEMENT",
    label: "Commission Statement",
    category: "Income",
    purpose: "Income Verification",
    fields: [
      { name: "payerName", label: "Employer / Brokerage Name", type: "text", sample: "Crown Realty Inc." },
      { name: "statementPeriod", label: "Statement Period", type: "text", sample: "2026-Q2" },
      { name: "commissionEarned", label: "Commission Earned (period)", type: "number", sample: 12400 },
      { name: "ytdCommission", label: "Year-to-Date Commission", type: "number", sample: 58200 },
    ],
    extract: (p) => ({
      payerName: str(p.payerName ?? p.payer_name),
      statementPeriod: str(p.statementPeriod ?? p.statement_period),
      commissionEarned: num(p.commissionEarned ?? p.commission_earned),
      ytdCommission: num(p.ytdCommission ?? p.ytd_commission),
    }),
    validate: () => [],
  },
  BONUS_LETTER: {
    kind: "BONUS_LETTER",
    label: "Bonus Letter",
    category: "Income",
    purpose: "Income Verification",
    fields: [
      { name: "employerName", label: "Employer Name", type: "text", sample: "Crown Holdings" },
      { name: "employeeName", label: "Employee Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "bonusAmount", label: "Bonus Amount", type: "number", sample: 8000 },
      { name: "bonusType", label: "Bonus Type", type: "text", sample: "Discretionary", hint: "Guaranteed | Discretionary" },
      { name: "letterDate", label: "Letter Date", type: "text", sample: "2026-01-15" },
    ],
    extract: (p) => ({
      employerName: str(p.employerName ?? p.employer_name),
      employeeName: str(p.employeeName ?? p.employee_name),
      bonusAmount: num(p.bonusAmount ?? p.bonus_amount),
      bonusType: str(p.bonusType ?? p.bonus_type),
      letterDate: str(p.letterDate ?? p.letter_date),
    }),
    validate: (e) =>
      str(e.bonusType).toLowerCase() === "discretionary"
        ? [{
            code: "BONUS-DISCRETIONARY",
            label: "Discretionary bonus disclosed",
            severity: "WARNING",
            detail: "Confirm 2-year averaging and continuance per lender policy for discretionary bonus income.",
            sourceDoc: "BONUS_LETTER",
            penaltyPoints: 5,
          }]
        : [],
  },
  PROFESSIONAL_LICENCE: {
    kind: "PROFESSIONAL_LICENCE",
    label: "Professional Licence",
    category: "Income",
    purpose: "Income Verification",
    fields: [
      { name: "holderName", label: "Holder Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "profession", label: "Profession", type: "text", sample: "Physician" },
      { name: "licenceNumber", label: "Licence Number", type: "text", sample: "PL-88213" },
      { name: "issuingBody", label: "Issuing Body", type: "text", sample: "College of Physicians and Surgeons of Ontario" },
      { name: "expiryDate", label: "Expiry Date", type: "text", sample: "2027-03-31" },
    ],
    extract: (p) => ({
      holderName: str(p.holderName ?? p.holder_name),
      profession: str(p.profession),
      licenceNumber: str(p.licenceNumber ?? p.licence_number),
      issuingBody: str(p.issuingBody ?? p.issuing_body),
      expiryDate: str(p.expiryDate ?? p.expiry_date),
    }),
    validate: (e) => {
      const days = daysUntil(e.expiryDate);
      return days != null && days < 0
        ? [{
            code: "PROF-LICENCE-EXPIRED",
            label: "Professional licence expired",
            severity: "WARNING",
            detail: `Licence expired ${Math.abs(days)} day(s) ago — confirm renewal before relying on this income.`,
            sourceDoc: "PROFESSIONAL_LICENCE",
            penaltyPoints: 10,
          }]
        : [];
    },
  },

  // ────────── ASSETS ──────────
  PERSONAL_BANK_STATEMENT: {
    kind: "PERSONAL_BANK_STATEMENT",
    label: "Personal Bank Statement",
    category: "Assets",
    purpose: "Down Payment",
    fields: [
      { name: "accountHolderName", label: "Account Holder Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "institutionName", label: "Financial Institution", type: "text", sample: "RBC Royal Bank" },
      { name: "accountNumber", label: "Account Number", type: "text", sample: "****1029" },
      { name: "statementPeriodEnd", label: "Statement Period End", type: "text", sample: "2026-06-30", aiHint: "This upload may contain multiple monthly statements concatenated into one file — if so, use the END date of the LATEST (most recent) statement period, not the first one in the document" },
      { name: "openingBalance", label: "Opening Balance", type: "number", sample: 18000, aiHint: "If multiple monthly statements are concatenated into one file, use the opening balance of the EARLIEST statement period" },
      { name: "closingBalance", label: "Closing Balance", type: "number", sample: 22500, aiHint: "If multiple monthly statements are concatenated into one file, use the closing balance of the LATEST statement period, not the first one" },
      { name: "nsfCount", label: "NSF Count", type: "number", sample: 0, aiHint: "Scan every page/month in the document, not just the first — count every NSF, non-sufficient-funds, overdraft, or returned-item fee line item across the entire file" },
    ],
    extract: (p) => ({
      accountHolderName: str(p.accountHolderName ?? p.account_holder_name),
      institutionName: str(p.institutionName ?? p.institution_name),
      accountNumber: str(p.accountNumber ?? p.account_number),
      statementPeriodEnd: str(p.statementPeriodEnd ?? p.statement_period_end),
      openingBalance: num(p.openingBalance ?? p.opening_balance),
      closingBalance: num(p.closingBalance ?? p.closing_balance),
      nsfCount: num(p.nsfCount ?? p.nsf_count),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const nsf = num(e.nsfCount);
      if (nsf > 0) {
        alerts.push({
          code: "PERSONAL-BANK-NSF",
          label: "NSF activity on personal bank statement",
          severity: "WARNING",
          detail: `${nsf} NSF event(s) reported.`,
          sourceDoc: "PERSONAL_BANK_STATEMENT",
          penaltyPoints: 5 * Math.min(nsf, 3),
        });
      }
      if (num(e.closingBalance) < 0) {
        alerts.push({
          code: "PERSONAL-BANK-NEGATIVE-BALANCE",
          label: "Negative personal account balance",
          severity: "HIGH",
          detail: `Closing balance = ${fmt(num(e.closingBalance))}.`,
          sourceDoc: "PERSONAL_BANK_STATEMENT",
          penaltyPoints: 15,
        });
      }
      return alerts;
    },
  },
  INVESTMENT_STATEMENT: {
    kind: "INVESTMENT_STATEMENT",
    label: "Investment Statement (Non-Registered)",
    category: "Assets",
    purpose: "Down Payment",
    fields: [
      { name: "accountHolderName", label: "Account Holder Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "institutionName", label: "Financial Institution", type: "text", sample: "RBC Dominion Securities" },
      { name: "accountNumber", label: "Account Number", type: "text", sample: "****7734" },
      { name: "statementDate", label: "Statement Date", type: "text", sample: "2026-06-30" },
      { name: "marketValue", label: "Market Value", type: "number", sample: 65000 },
    ],
    extract: (p) => ({
      accountHolderName: str(p.accountHolderName ?? p.account_holder_name),
      institutionName: str(p.institutionName ?? p.institution_name),
      accountNumber: str(p.accountNumber ?? p.account_number),
      statementDate: str(p.statementDate ?? p.statement_date),
      marketValue: num(p.marketValue ?? p.market_value),
    }),
    validate: () => [],
  },
  // Merges: RRSP Statement, TFSA Statement, FHSA Statement. All three are a
  // "current balance as of a statement date" document with identical shape;
  // the underwriting nuance (HBP repayment for RRSP, FHSA qualifying-
  // withdrawal rules, no special rule for TFSA) is captured by branching
  // validate() on `accountType` rather than by three separate kinds. Distinct
  // from the existing T4RSP/T4FHSA tax slips, which report a *withdrawal
  // reported in a tax year* — a different fact (income/tax reporting) from
  // this document's *current balance* (asset/down-payment verification).
  REGISTERED_ACCOUNT_STATEMENT: {
    kind: "REGISTERED_ACCOUNT_STATEMENT",
    label: "Registered Account Statement (RRSP / TFSA / FHSA)",
    category: "Assets",
    purpose: "Down Payment",
    fields: [
      { name: "accountType", label: "Account Type", type: "text", sample: "RRSP", hint: "RRSP | TFSA | FHSA" },
      { name: "accountHolderName", label: "Account Holder Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "institutionName", label: "Financial Institution", type: "text", sample: "RBC Royal Bank" },
      { name: "statementDate", label: "Statement Date", type: "text", sample: "2026-06-30" },
      { name: "balance", label: "Balance", type: "number", sample: 34000 },
    ],
    extract: (p) => ({
      accountType: str(p.accountType ?? p.account_type),
      accountHolderName: str(p.accountHolderName ?? p.account_holder_name),
      institutionName: str(p.institutionName ?? p.institution_name),
      statementDate: str(p.statementDate ?? p.statement_date),
      balance: num(p.balance),
    }),
    validate: (e) => {
      const type = str(e.accountType).toUpperCase();
      if (type === "RRSP") {
        return [{
          code: "RRSP-HBP-REMINDER",
          label: "RRSP source — confirm Home Buyers' Plan treatment",
          severity: "INFO",
          detail: "If any portion of this balance is withdrawn for the down payment, confirm HBP withdrawal limits and the repayment schedule.",
          sourceDoc: "REGISTERED_ACCOUNT_STATEMENT",
          penaltyPoints: 0,
        }];
      }
      if (type === "FHSA") {
        return [{
          code: "FHSA-QUALIFYING-WITHDRAWAL-REMINDER",
          label: "FHSA source — confirm qualifying withdrawal",
          severity: "INFO",
          detail: "Confirm the withdrawal qualifies as a first-time home buyer qualifying withdrawal under FHSA rules.",
          sourceDoc: "REGISTERED_ACCOUNT_STATEMENT",
          penaltyPoints: 0,
        }];
      }
      return [];
    },
  },
  CRYPTO_STATEMENT: {
    kind: "CRYPTO_STATEMENT",
    label: "Cryptocurrency Statement",
    category: "Assets",
    purpose: "Down Payment",
    fields: [
      { name: "accountHolderName", label: "Account Holder Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "exchangeName", label: "Exchange / Custodian", type: "text", sample: "Coinbase" },
      { name: "statementDate", label: "Statement Date", type: "text", sample: "2026-06-30" },
      { name: "portfolioValueCAD", label: "Portfolio Value (CAD)", type: "number", sample: 22000 },
      { name: "primaryAsset", label: "Primary Asset", type: "text", sample: "BTC" },
    ],
    extract: (p) => ({
      accountHolderName: str(p.accountHolderName ?? p.account_holder_name),
      exchangeName: str(p.exchangeName ?? p.exchange_name),
      statementDate: str(p.statementDate ?? p.statement_date),
      portfolioValueCAD: num(p.portfolioValueCAD ?? p.portfolio_value_cad),
      primaryAsset: str(p.primaryAsset ?? p.primary_asset),
    }),
    validate: () => [{
      code: "CRYPTO-SOURCE-OF-FUNDS",
      label: "Cryptocurrency asset disclosed",
      severity: "WARNING",
      detail: "Verify source of funds and confirm the conversion-to-CAD timeline before counting this balance toward the down payment.",
      sourceDoc: "CRYPTO_STATEMENT",
      penaltyPoints: 10,
    }],
  },
  FOREIGN_ASSET_STATEMENT: {
    kind: "FOREIGN_ASSET_STATEMENT",
    label: "Foreign Asset Statement",
    category: "Assets",
    purpose: "Down Payment",
    fields: [
      { name: "accountHolderName", label: "Account Holder Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "institutionName", label: "Financial Institution", type: "text", sample: "HSBC UK" },
      { name: "country", label: "Country", type: "text", sample: "United Kingdom" },
      { name: "statementDate", label: "Statement Date", type: "text", sample: "2026-06-30" },
      { name: "currencyCode", label: "Currency", type: "text", sample: "GBP" },
      { name: "balanceLocalCurrency", label: "Balance (Local Currency)", type: "number", sample: 15000 },
      { name: "balanceCAD", label: "Balance (CAD, if converted)", type: "number", sample: 25500 },
    ],
    extract: (p) => ({
      accountHolderName: str(p.accountHolderName ?? p.account_holder_name),
      institutionName: str(p.institutionName ?? p.institution_name),
      country: str(p.country),
      statementDate: str(p.statementDate ?? p.statement_date),
      currencyCode: str(p.currencyCode ?? p.currency_code),
      balanceLocalCurrency: num(p.balanceLocalCurrency ?? p.balance_local_currency),
      balanceCAD: num(p.balanceCAD ?? p.balance_cad),
    }),
    validate: () => [{
      code: "FOREIGN-ASSET-SOURCE-OF-FUNDS",
      label: "Foreign asset disclosed",
      severity: "WARNING",
      detail: "Confirm source-of-funds documentation and currency conversion supporting the CAD figure used for down payment verification.",
      sourceDoc: "FOREIGN_ASSET_STATEMENT",
      penaltyPoints: 10,
    }],
  },
  GIFT_LETTER: {
    kind: "GIFT_LETTER",
    label: "Gift Letter",
    category: "Assets",
    purpose: "Down Payment",
    fields: [
      { name: "donorName", label: "Donor Name", type: "text", sample: "Sana Minhas" },
      { name: "donorRelationship", label: "Donor Relationship", type: "text", sample: "Parent" },
      { name: "recipientName", label: "Recipient Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "giftAmount", label: "Gift Amount", type: "number", sample: 25000 },
      { name: "giftDate", label: "Gift Date", type: "text", sample: "2026-05-01" },
      { name: "repaymentExpected", label: "Repayment Expected?", type: "boolean", sample: false },
    ],
    extract: (p) => ({
      donorName: str(p.donorName ?? p.donor_name),
      donorRelationship: str(p.donorRelationship ?? p.donor_relationship),
      recipientName: str(p.recipientName ?? p.recipient_name),
      giftAmount: num(p.giftAmount ?? p.gift_amount),
      giftDate: str(p.giftDate ?? p.gift_date),
      repaymentExpected: bool(p.repaymentExpected ?? p.repayment_expected),
    }),
    validate: (e) =>
      bool(e.repaymentExpected)
        ? [{
            code: "GIFT-REPAYMENT-DISCLOSED",
            label: "Gift letter indicates repayment expected",
            severity: "CRITICAL",
            detail: "A bona fide gift must be non-repayable. Repayment expectation disqualifies this as a down payment gift.",
            sourceDoc: "GIFT_LETTER",
            penaltyPoints: 40,
          }]
        : [],
  },
  LARGE_DEPOSIT_DOCUMENTATION: {
    kind: "LARGE_DEPOSIT_DOCUMENTATION",
    label: "Large Deposit Documentation",
    category: "Assets",
    purpose: "Down Payment",
    fields: [
      { name: "accountHolderName", label: "Account Holder Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "depositAmount", label: "Deposit Amount", type: "number", sample: 12000 },
      { name: "depositDate", label: "Deposit Date", type: "text", sample: "2026-05-20" },
      { name: "sourceDescription", label: "Source Description", type: "text", sample: "Sale of vehicle" },
      { name: "supportingDocumentReference", label: "Supporting Document Reference", type: "text", sample: "Bill of sale attached" },
    ],
    extract: (p) => ({
      accountHolderName: str(p.accountHolderName ?? p.account_holder_name),
      depositAmount: num(p.depositAmount ?? p.deposit_amount),
      depositDate: str(p.depositDate ?? p.deposit_date),
      sourceDescription: str(p.sourceDescription ?? p.source_description),
      supportingDocumentReference: str(p.supportingDocumentReference ?? p.supporting_document_reference),
    }),
    validate: (e) =>
      !str(e.sourceDescription)
        ? [{
            code: "LARGE-DEPOSIT-UNEXPLAINED",
            label: "Large deposit lacks source explanation",
            severity: "HIGH",
            detail: `${fmt(num(e.depositAmount))} deposit has no documented source — required for AML / source-of-funds verification.`,
            sourceDoc: "LARGE_DEPOSIT_DOCUMENTATION",
            penaltyPoints: 20,
          }]
        : [],
  },

  // ────────── PROPERTY ──────────
  AGREEMENT_OF_PURCHASE_SALE: {
    kind: "AGREEMENT_OF_PURCHASE_SALE",
    label: "Agreement of Purchase and Sale",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "buyerName", label: "Buyer Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "sellerName", label: "Seller Name", type: "text", sample: "Jordan Lee" },
      { name: "purchasePrice", label: "Purchase Price", type: "number", sample: 850000 },
      { name: "depositAmount", label: "Deposit Amount", type: "number", sample: 42500 },
      { name: "closingDate", label: "Closing Date", type: "text", sample: "2026-09-15" },
      { name: "conditionsWaived", label: "Conditions Waived?", type: "boolean", sample: true },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      buyerName: str(p.buyerName ?? p.buyer_name),
      sellerName: str(p.sellerName ?? p.seller_name),
      purchasePrice: num(p.purchasePrice ?? p.purchase_price),
      depositAmount: num(p.depositAmount ?? p.deposit_amount),
      closingDate: str(p.closingDate ?? p.closing_date),
      conditionsWaived: bool(p.conditionsWaived ?? p.conditions_waived),
    }),
    validate: (e) =>
      bool(e.conditionsWaived)
        ? []
        : [{
            code: "APS-CONDITIONAL",
            label: "Purchase agreement still conditional",
            severity: "WARNING",
            detail: "Confirm firm/unconditional status of the Agreement of Purchase and Sale before funding.",
            sourceDoc: "AGREEMENT_OF_PURCHASE_SALE",
            penaltyPoints: 10,
          }],
  },
  BUILDER_PURCHASE_AGREEMENT: {
    kind: "BUILDER_PURCHASE_AGREEMENT",
    label: "Builder Purchase Agreement",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "builderName", label: "Builder Name", type: "text", sample: "Mattamy Homes" },
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "45 New Estate Dr, Milton, ON" },
      { name: "purchasePrice", label: "Purchase Price", type: "number", sample: 950000 },
      { name: "depositAmount", label: "Deposit Amount", type: "number", sample: 95000 },
      { name: "estimatedClosingDate", label: "Estimated Closing Date", type: "text", sample: "2027-03-01" },
      { name: "occupancyDate", label: "Occupancy Date", type: "text", sample: "" },
    ],
    extract: (p) => ({
      builderName: str(p.builderName ?? p.builder_name),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      purchasePrice: num(p.purchasePrice ?? p.purchase_price),
      depositAmount: num(p.depositAmount ?? p.deposit_amount),
      estimatedClosingDate: str(p.estimatedClosingDate ?? p.estimated_closing_date),
      occupancyDate: str(p.occupancyDate ?? p.occupancy_date),
    }),
    validate: () => [],
  },
  ASSIGNMENT_AGREEMENT: {
    kind: "ASSIGNMENT_AGREEMENT",
    label: "Assignment Agreement",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "45 New Estate Dr, Milton, ON" },
      { name: "assignor", label: "Assignor", type: "text", sample: "Jordan Lee" },
      { name: "assignee", label: "Assignee", type: "text", sample: "Mujeeb Minhas" },
      { name: "originalPurchasePrice", label: "Original Purchase Price", type: "number", sample: 850000 },
      { name: "assignmentPrice", label: "Assignment Price", type: "number", sample: 920000 },
      { name: "assignmentDate", label: "Assignment Date", type: "text", sample: "2026-04-01" },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      assignor: str(p.assignor),
      assignee: str(p.assignee),
      originalPurchasePrice: num(p.originalPurchasePrice ?? p.original_purchase_price),
      assignmentPrice: num(p.assignmentPrice ?? p.assignment_price),
      assignmentDate: str(p.assignmentDate ?? p.assignment_date),
    }),
    validate: (e) => {
      const orig = num(e.originalPurchasePrice);
      const assign = num(e.assignmentPrice);
      if (orig > 0 && assign > 0 && assign / orig - 1 > 0.15) {
        return [{
          code: "ASSIGNMENT-LARGE-UPLIFT",
          label: "Significant assignment price uplift",
          severity: "WARNING",
          detail: `Assignment price ${fmt(assign)} is ${(((assign / orig) - 1) * 100).toFixed(1)}% above the original purchase price ${fmt(orig)} — confirm lender policy on assignment sales.`,
          sourceDoc: "ASSIGNMENT_AGREEMENT",
          penaltyPoints: 10,
        }];
      }
      return [];
    },
  },
  MLS_LISTING: {
    kind: "MLS_LISTING",
    label: "MLS Listing",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "mlsNumber", label: "MLS Number", type: "text", sample: "C5678901" },
      { name: "listPrice", label: "List Price", type: "number", sample: 875000 },
      { name: "listingDate", label: "Listing Date", type: "text", sample: "2026-06-01" },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      mlsNumber: str(p.mlsNumber ?? p.mls_number),
      listPrice: num(p.listPrice ?? p.list_price),
      listingDate: str(p.listingDate ?? p.listing_date),
    }),
    validate: () => [],
  },
  APPRAISAL_REPORT: {
    kind: "APPRAISAL_REPORT",
    label: "Appraisal Report",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "appraisedValue", label: "Appraised Value", type: "number", sample: 865000 },
      { name: "appraisalDate", label: "Appraisal Date", type: "text", sample: "2026-07-01" },
      { name: "appraiserName", label: "Appraiser Name", type: "text", sample: "Jordan Lee, AACI" },
      { name: "appraisalType", label: "Appraisal Type", type: "text", sample: "Full", hint: "Full | Drive-by | Desktop | AVM" },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      appraisedValue: num(p.appraisedValue ?? p.appraised_value),
      appraisalDate: str(p.appraisalDate ?? p.appraisal_date),
      appraiserName: str(p.appraiserName ?? p.appraiser_name),
      appraisalType: str(p.appraisalType ?? p.appraisal_type),
    }),
    validate: () => [],
  },
  CONDO_STATUS_CERTIFICATE: {
    kind: "CONDO_STATUS_CERTIFICATE",
    label: "Condo Status Certificate",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "corporationName", label: "Condo Corporation Name", type: "text", sample: "TSCC 2201" },
      { name: "reserveFundBalance", label: "Reserve Fund Balance", type: "number", sample: 1_200_000 },
      { name: "monthlyMaintenanceFee", label: "Monthly Maintenance Fee", type: "number", sample: 620 },
      { name: "specialAssessment", label: "Special Assessment Disclosed?", type: "boolean", sample: false },
      { name: "litigationPending", label: "Litigation Pending?", type: "boolean", sample: false },
      { name: "certificateDate", label: "Certificate Date", type: "text", sample: "2026-06-15" },
    ],
    extract: (p) => ({
      corporationName: str(p.corporationName ?? p.corporation_name),
      reserveFundBalance: num(p.reserveFundBalance ?? p.reserve_fund_balance),
      monthlyMaintenanceFee: num(p.monthlyMaintenanceFee ?? p.monthly_maintenance_fee),
      specialAssessment: bool(p.specialAssessment ?? p.special_assessment),
      litigationPending: bool(p.litigationPending ?? p.litigation_pending),
      certificateDate: str(p.certificateDate ?? p.certificate_date),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      if (bool(e.specialAssessment)) {
        alerts.push({
          code: "CONDO-SPECIAL-ASSESSMENT",
          label: "Special assessment disclosed on condo status certificate",
          severity: "HIGH",
          detail: "Confirm the special assessment amount and payment terms before funding.",
          sourceDoc: "CONDO_STATUS_CERTIFICATE",
          penaltyPoints: 20,
        });
      }
      if (bool(e.litigationPending)) {
        alerts.push({
          code: "CONDO-LITIGATION-PENDING",
          label: "Active litigation disclosed on condo status certificate",
          severity: "CRITICAL",
          detail: "Review litigation details with legal counsel before proceeding.",
          sourceDoc: "CONDO_STATUS_CERTIFICATE",
          penaltyPoints: 35,
        });
      }
      return alerts;
    },
  },
  // Merges: Property Tax Bill, Property Tax Arrears Notice. Same underlying
  // document (a municipal tax statement); "arrears" is a state derived from
  // the extracted `arrearsAmount`, exactly like the existing PD7A/NET34
  // pattern of deriving a lien flag from an amount rather than a separate
  // document kind — not a workflow-stage variant that needs its own kind.
  PROPERTY_TAX_STATEMENT: {
    kind: "PROPERTY_TAX_STATEMENT",
    label: "Property Tax Statement",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "taxYear", label: "Tax Year", type: "number", sample: 2026 },
      { name: "annualTaxAmount", label: "Annual Tax Amount", type: "number", sample: 5200 },
      { name: "arrearsAmount", label: "Arrears Amount", type: "number", sample: 0 },
      { name: "dueDate", label: "Due Date", type: "text", sample: "2026-07-31" },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      taxYear: num(p.taxYear ?? p.tax_year),
      annualTaxAmount: num(p.annualTaxAmount ?? p.annual_tax_amount),
      arrearsAmount: num(p.arrearsAmount ?? p.arrears_amount ?? p.amountOwing ?? p.amount_owing),
      dueDate: str(p.dueDate ?? p.due_date),
    }),
    validate: (e) =>
      arrearsFlag(
        "PROPERTY_TAX_STATEMENT",
        num(e.arrearsAmount),
        "PROPERTY-TAX-ARREARS",
        "Property tax arrears outstanding",
        "HIGH",
        25,
        true,
      ),
  },
  HOME_INSURANCE_BINDER: {
    kind: "HOME_INSURANCE_BINDER",
    label: "Home Insurance Binder",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "insurerName", label: "Insurer Name", type: "text", sample: "Aviva Canada" },
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "policyNumber", label: "Policy Number", type: "text", sample: "HP-9982134" },
      { name: "coverageAmount", label: "Coverage Amount", type: "number", sample: 850000 },
      { name: "effectiveDate", label: "Effective Date", type: "text", sample: "2026-09-15" },
      { name: "expiryDate", label: "Expiry Date", type: "text", sample: "2027-09-15" },
      { name: "mortgageeClause", label: "Mortgagee Clause Naming Lender?", type: "boolean", sample: true },
    ],
    extract: (p) => ({
      insurerName: str(p.insurerName ?? p.insurer_name),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      policyNumber: str(p.policyNumber ?? p.policy_number),
      coverageAmount: num(p.coverageAmount ?? p.coverage_amount),
      effectiveDate: str(p.effectiveDate ?? p.effective_date),
      expiryDate: str(p.expiryDate ?? p.expiry_date),
      mortgageeClause: bool(p.mortgageeClause ?? p.mortgagee_clause),
    }),
    validate: (e) =>
      bool(e.mortgageeClause)
        ? []
        : [{
            code: "INSURANCE-MISSING-MORTGAGEE-CLAUSE",
            label: "Insurance binder missing mortgagee clause",
            severity: "HIGH",
            detail: "Binder does not confirm a mortgagee clause naming the lender — required prior to funding.",
            sourceDoc: "HOME_INSURANCE_BINDER",
            penaltyPoints: 20,
          }],
  },
  TITLE_INSURANCE: {
    kind: "TITLE_INSURANCE",
    label: "Title Insurance Policy",
    category: "Property",
    purpose: "Ownership / Compliance",
    fields: [
      { name: "insurerName", label: "Insurer Name", type: "text", sample: "FCT Insurance Company Ltd." },
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "policyNumber", label: "Policy Number", type: "text", sample: "TI-4471203" },
      { name: "coverageAmount", label: "Coverage Amount", type: "number", sample: 850000 },
      { name: "effectiveDate", label: "Effective Date", type: "text", sample: "2026-09-15" },
    ],
    extract: (p) => ({
      insurerName: str(p.insurerName ?? p.insurer_name),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      policyNumber: str(p.policyNumber ?? p.policy_number),
      coverageAmount: num(p.coverageAmount ?? p.coverage_amount),
      effectiveDate: str(p.effectiveDate ?? p.effective_date),
    }),
    validate: () => [],
  },
  SURVEY_PLAN: {
    kind: "SURVEY_PLAN",
    label: "Survey Plan",
    category: "Property",
    purpose: "Property Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "123 Bay St, Toronto, ON" },
      { name: "surveyDate", label: "Survey Date", type: "text", sample: "2025-11-01" },
      { name: "surveyorName", label: "Surveyor Name", type: "text", sample: "Jordan Lee, OLS" },
      { name: "encroachmentsNoted", label: "Encroachments Noted?", type: "boolean", sample: false },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      surveyDate: str(p.surveyDate ?? p.survey_date),
      surveyorName: str(p.surveyorName ?? p.surveyor_name),
      encroachmentsNoted: bool(p.encroachmentsNoted ?? p.encroachments_noted),
    }),
    validate: (e) =>
      bool(e.encroachmentsNoted)
        ? [{
            code: "SURVEY-ENCROACHMENT",
            label: "Survey discloses encroachment",
            severity: "WARNING",
            detail: "Confirm title insurance coverage or resolution of the disclosed encroachment.",
            sourceDoc: "SURVEY_PLAN",
            penaltyPoints: 15,
          }]
        : [],
  },

  // ────────── LIABILITIES ──────────
  //
  // Phase 1.7 architecture review: DEBT_ACCOUNT_STATEMENT originally merged
  // Mortgage/HELOC/Credit Card/Loan/LOC into one kind with an `accountType`
  // discriminator. On review, Mortgage and HELOC statements carry
  // underwriting-specific fields a flat merge can't represent without either
  // bloating every credit-card/loan intake with irrelevant fields or
  // silently dropping them: amortization remaining, maturity/renewal date,
  // interest type (fixed/variable), mortgage product, and payout penalty —
  // none of which a credit card or personal loan statement has. That's a
  // real loss of underwriting fidelity, not a cosmetic one, so Mortgage and
  // HELOC are split out into their own specialized kinds below. Credit
  // Card/Loan/Line of Credit remain merged under DEBT_ACCOUNT_STATEMENT —
  // those three genuinely share one shape (institution/balance/limit/
  // payment/rate/status) with no analogous underwriting-specific fields, so
  // splitting them further would add kinds without adding fidelity.
  //
  // All three share a base field/extract shape (DEBT_BASE_FIELDS /
  // extractDebtBase) so the shared shape stays DRY across the specialized
  // kinds — "shared base model with specialized document definitions" per
  // the review brief, not just three unrelated copies.

  MORTGAGE_STATEMENT: {
    kind: "MORTGAGE_STATEMENT",
    label: "Mortgage Statement",
    category: "Liabilities",
    purpose: "Debt Verification",
    fields: [
      ...DEBT_BASE_FIELDS,
      { name: "mortgageProduct", label: "Mortgage Product", type: "text", sample: "5-Year Fixed Closed" },
      { name: "originalPrincipal", label: "Original Principal", type: "number", sample: 620000 },
      { name: "interestType", label: "Interest Type", type: "text", sample: "Fixed", hint: "Fixed | Variable | Adjustable" },
      { name: "amortizationRemainingMonths", label: "Amortization Remaining (months)", type: "number", sample: 264 },
      { name: "maturityDate", label: "Maturity / Renewal Date", type: "text", sample: "2028-11-01" },
      { name: "penaltyAmount", label: "Prepayment Penalty (if disclosed)", type: "number", sample: 0 },
    ],
    extract: (p) => ({
      ...extractDebtBase(p),
      mortgageProduct: str(p.mortgageProduct ?? p.mortgage_product),
      originalPrincipal: num(p.originalPrincipal ?? p.original_principal),
      interestType: str(p.interestType ?? p.interest_type),
      amortizationRemainingMonths: num(p.amortizationRemainingMonths ?? p.amortization_remaining_months),
      maturityDate: str(p.maturityDate ?? p.maturity_date ?? p.renewalDate ?? p.renewal_date),
      penaltyAmount: num(p.penaltyAmount ?? p.penalty_amount),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      if (str(e.accountStatus).toLowerCase() === "arrears") {
        alerts.push({
          code: "MORTGAGE-ARREARS",
          label: "Existing mortgage in arrears",
          severity: "HIGH",
          detail: `Mortgage at ${str(e.institutionName)} reported in arrears.`,
          sourceDoc: "MORTGAGE_STATEMENT",
          penaltyPoints: 20,
        });
      }
      const days = daysUntil(e.maturityDate);
      if (days != null && days >= 0 && days <= 120) {
        alerts.push({
          code: "MORTGAGE-MATURING-SOON",
          label: "Mortgage maturing within 120 days",
          severity: "WARNING",
          detail: `Maturity/renewal date in ${days} day(s) — confirm renewal or payout strategy.`,
          sourceDoc: "MORTGAGE_STATEMENT",
          penaltyPoints: 5,
        });
      }
      if (num(e.penaltyAmount) > 0) {
        alerts.push({
          code: "MORTGAGE-PAYOUT-PENALTY",
          label: "Prepayment penalty disclosed",
          severity: "WARNING",
          detail: `${fmt(num(e.penaltyAmount))} penalty disclosed — factor into refinance/consolidation math.`,
          sourceDoc: "MORTGAGE_STATEMENT",
          penaltyPoints: 5,
        });
      }
      return alerts;
    },
  },
  HELOC_STATEMENT: {
    kind: "HELOC_STATEMENT",
    label: "HELOC Statement",
    category: "Liabilities",
    purpose: "Debt Verification",
    fields: [
      ...DEBT_BASE_FIELDS,
      { name: "creditLimit", label: "Credit Limit", type: "number", sample: 100000 },
      { name: "interestType", label: "Interest Type", type: "text", sample: "Variable", hint: "Fixed | Variable" },
    ],
    extract: (p) => ({
      ...extractDebtBase(p),
      creditLimit: num(p.creditLimit ?? p.credit_limit),
      interestType: str(p.interestType ?? p.interest_type),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      if (str(e.accountStatus).toLowerCase() === "arrears") {
        alerts.push({
          code: "HELOC-ARREARS",
          label: "Existing HELOC in arrears",
          severity: "HIGH",
          detail: `HELOC at ${str(e.institutionName)} reported in arrears.`,
          sourceDoc: "HELOC_STATEMENT",
          penaltyPoints: 20,
        });
      }
      const limit = num(e.creditLimit);
      const balance = num(e.currentBalance);
      if (limit > 0 && balance / limit > 0.9) {
        alerts.push({
          code: "HELOC-HIGH-UTILIZATION",
          label: "High utilization on HELOC",
          severity: "WARNING",
          detail: `Balance ${fmt(balance)} is ${((balance / limit) * 100).toFixed(0)}% of the ${fmt(limit)} limit.`,
          sourceDoc: "HELOC_STATEMENT",
          penaltyPoints: 10,
        });
      }
      return alerts;
    },
  },
  // Merges: Credit Card Statement, Loan Statement, Line of Credit Statement
  // only (Mortgage/HELOC split out above — see banner comment). These three
  // share one shape with no mortgage/HELOC-grade underwriting fields of
  // their own, so a flat `accountType` discriminator loses nothing here.
  DEBT_ACCOUNT_STATEMENT: {
    kind: "DEBT_ACCOUNT_STATEMENT",
    label: "Existing Debt Account Statement (Credit Card / Loan / Line of Credit)",
    category: "Liabilities",
    purpose: "Debt Verification",
    fields: [
      { name: "accountType", label: "Account Type", type: "text", sample: "Credit Card", hint: "Credit Card | Loan | Line of Credit" },
      ...DEBT_BASE_FIELDS,
      { name: "creditLimit", label: "Credit Limit (revolving accounts)", type: "number", sample: 20000 },
    ],
    extract: (p) => ({
      accountType: str(p.accountType ?? p.account_type),
      ...extractDebtBase(p),
      creditLimit: num(p.creditLimit ?? p.credit_limit),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const type = str(e.accountType);
      if (str(e.accountStatus).toLowerCase() === "arrears") {
        alerts.push({
          code: "DEBT-ACCOUNT-ARREARS",
          label: `Existing ${type || "debt"} account in arrears`,
          severity: "HIGH",
          detail: `${type || "Account"} at ${str(e.institutionName)} reported in arrears.`,
          sourceDoc: "DEBT_ACCOUNT_STATEMENT",
          penaltyPoints: 20,
        });
      }
      const limit = num(e.creditLimit);
      const balance = num(e.currentBalance);
      const revolving = ["credit card", "line of credit"].includes(type.toLowerCase());
      if (revolving && limit > 0 && balance / limit > 0.9) {
        alerts.push({
          code: "DEBT-ACCOUNT-HIGH-UTILIZATION",
          label: "High utilization on revolving credit account",
          severity: "WARNING",
          detail: `Balance ${fmt(balance)} is ${((balance / limit) * 100).toFixed(0)}% of the ${fmt(limit)} limit.`,
          sourceDoc: "DEBT_ACCOUNT_STATEMENT",
          penaltyPoints: 10,
        });
      }
      return alerts;
    },
  },
  CRA_REQUIREMENT_TO_PAY: {
    kind: "CRA_REQUIREMENT_TO_PAY",
    label: "CRA Requirement to Pay",
    category: "Liabilities",
    purpose: "Debt Verification",
    fields: [
      { name: "businessNumberOrSin", label: "Business Number / SIN", type: "text", sample: "123456789" },
      { name: "recipientName", label: "Recipient Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "amountDemanded", label: "Amount Demanded", type: "number", sample: 14200 },
      { name: "issueDate", label: "Issue Date", type: "text", sample: "2026-04-01" },
    ],
    extract: (p) => ({
      businessNumberOrSin: str(p.businessNumberOrSin ?? p.business_number_or_sin ?? p.businessNumber ?? p.sin),
      recipientName: str(p.recipientName ?? p.recipient_name),
      amountDemanded: num(p.amountDemanded ?? p.amount_demanded),
      issueDate: str(p.issueDate ?? p.issue_date),
    }),
    validate: (e) =>
      arrearsFlag(
        "CRA_REQUIREMENT_TO_PAY",
        num(e.amountDemanded),
        "CRA-REQUIREMENT-TO-PAY",
        "CRA Requirement to Pay issued — statutory garnishment",
        "CRITICAL",
        50,
        true,
      ),
  },

  // ────────── CREDIT ──────────
  // Merges: Equifax Mortgage Credit Report, TransUnion Mortgage Credit
  // Report. The bureau is metadata (`bureau`), not a different document —
  // CreditProfilePanel/creditProfileStore already treat "Beacon score"
  // generically regardless of which bureau produced it.
  CREDIT_BUREAU_REPORT: {
    kind: "CREDIT_BUREAU_REPORT",
    label: "Credit Bureau Report",
    category: "Credit",
    purpose: "Credit Assessment",
    fields: [
      { name: "bureau", label: "Bureau", type: "text", sample: "Equifax", hint: "Equifax | TransUnion" },
      { name: "subjectName", label: "Subject Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "beaconScore", label: "Beacon Score", type: "number", sample: 712 },
      { name: "reportDate", label: "Report Date", type: "text", sample: "2026-06-01" },
      { name: "collectionsCount", label: "Collections Count", type: "number", sample: 0 },
      { name: "publicRecordsCount", label: "Public Records Count", type: "number", sample: 0 },
      { name: "mortgageBalanceReported", label: "Largest Reported Mortgage Balance", type: "number", sample: 412000, hint: "Largest mortgage tradeline balance shown on the report, if any — a v1 proxy pending full itemized tradeline support" },
    ],
    extract: (p) => ({
      bureau: str(p.bureau),
      subjectName: str(p.subjectName ?? p.subject_name),
      beaconScore: num(p.beaconScore ?? p.beacon_score),
      reportDate: str(p.reportDate ?? p.report_date),
      collectionsCount: num(p.collectionsCount ?? p.collections_count),
      publicRecordsCount: num(p.publicRecordsCount ?? p.public_records_count),
      mortgageBalanceReported: num(p.mortgageBalanceReported ?? p.mortgage_balance_reported),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const score = num(e.beaconScore);
      // Heuristic credit-risk indicator only — deliberately does NOT assert
      // which lender/insurer stream this qualifies for. Which score range
      // maps to which lender's program is a lender-specific published
      // guideline (varies by institution and changes over time) and belongs
      // in the future Policy Engine (docs/ROADMAP.md Phase 4), not here.
      if (score > 0 && score < 600) {
        alerts.push({
          code: "CREDIT-BEACON-LOW",
          label: "Low Beacon score",
          severity: "HIGH",
          detail: `Beacon score ${score} is a heuristic credit-risk indicator — lender/program eligibility is a Policy Engine decision, not evaluated here.`,
          sourceDoc: "CREDIT_BUREAU_REPORT",
          penaltyPoints: 15,
        });
      }
      if (num(e.collectionsCount) > 0) {
        alerts.push({
          code: "CREDIT-COLLECTIONS-REPORTED",
          label: "Collections reported on credit bureau file",
          severity: "WARNING",
          detail: `${num(e.collectionsCount)} collection(s) reported.`,
          sourceDoc: "CREDIT_BUREAU_REPORT",
          penaltyPoints: 10,
        });
      }
      if (num(e.publicRecordsCount) > 0) {
        alerts.push({
          code: "CREDIT-PUBLIC-RECORDS-REPORTED",
          label: "Public records reported on credit bureau file",
          severity: "HIGH",
          detail: `${num(e.publicRecordsCount)} public record(s) (judgment/lien) reported.`,
          sourceDoc: "CREDIT_BUREAU_REPORT",
          penaltyPoints: 20,
        });
      }
      return alerts;
    },
  },
  // Merges: Bankruptcy Documents, Consumer Proposal Documents. Both are an
  // insolvency-proceeding record with the same shape (filing date, discharge/
  // completion date, trustee, discharged status); `recordType` distinguishes
  // them where treatment genuinely differs (discharge vs. completion
  // terminology) without needing two parallel kinds.
  INSOLVENCY_RECORD: {
    kind: "INSOLVENCY_RECORD",
    label: "Insolvency Record (Bankruptcy / Consumer Proposal)",
    category: "Credit",
    purpose: "Credit Assessment",
    fields: [
      { name: "recordType", label: "Record Type", type: "text", sample: "Bankruptcy", hint: "Bankruptcy | Consumer Proposal" },
      { name: "filingDate", label: "Filing Date", type: "text", sample: "2022-01-15" },
      { name: "dischargeOrCompletionDate", label: "Discharge / Completion Date", type: "text", sample: "2023-01-15" },
      { name: "isDischarged", label: "Discharged / Completed?", type: "boolean", sample: true },
      { name: "trusteeName", label: "Trustee Name", type: "text", sample: "BDO Canada" },
    ],
    extract: (p) => ({
      recordType: str(p.recordType ?? p.record_type),
      filingDate: str(p.filingDate ?? p.filing_date),
      dischargeOrCompletionDate: str(p.dischargeOrCompletionDate ?? p.discharge_or_completion_date),
      isDischarged: bool(p.isDischarged ?? p.is_discharged),
      trusteeName: str(p.trusteeName ?? p.trustee_name),
    }),
    validate: (e) => {
      const type = str(e.recordType) || "Insolvency record";
      if (!bool(e.isDischarged)) {
        return [{
          code: "INSOLVENCY-NOT-DISCHARGED",
          label: `${type} not yet discharged/completed`,
          severity: "CRITICAL",
          detail: "Active insolvency proceeding — not eligible for conventional financing until discharged/completed.",
          sourceDoc: "INSOLVENCY_RECORD",
          penaltyPoints: 40,
        }];
      }
      return [{
        code: "INSOLVENCY-DISCHARGED-SEASONING",
        label: `${type} discharged — confirm seasoning`,
        severity: "WARNING",
        detail: "Confirm lender-specific post-discharge seasoning and re-established credit requirements.",
        sourceDoc: "INSOLVENCY_RECORD",
        penaltyPoints: 10,
      }];
    },
  },

  // ────────── RENTAL ──────────
  LEASE_AGREEMENT: {
    kind: "LEASE_AGREEMENT",
    label: "Lease Agreement",
    category: "Rental",
    purpose: "Rental Income",
    fields: [
      { name: "tenantName", label: "Tenant Name", type: "text", sample: "Jordan Lee" },
      { name: "landlordName", label: "Landlord Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "45 Rental Ave, Unit 3, Toronto, ON" },
      { name: "monthlyRent", label: "Monthly Rent", type: "number", sample: 2400 },
      { name: "leaseStartDate", label: "Lease Start Date", type: "text", sample: "2026-01-01" },
      { name: "leaseEndDate", label: "Lease End Date", type: "text", sample: "2026-12-31" },
      { name: "leaseType", label: "Lease Type", type: "text", sample: "Fixed-Term", hint: "Fixed-Term | Month-to-Month" },
    ],
    extract: (p) => ({
      tenantName: str(p.tenantName ?? p.tenant_name),
      landlordName: str(p.landlordName ?? p.landlord_name),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      monthlyRent: num(p.monthlyRent ?? p.monthly_rent),
      leaseStartDate: str(p.leaseStartDate ?? p.lease_start_date),
      leaseEndDate: str(p.leaseEndDate ?? p.lease_end_date),
      leaseType: str(p.leaseType ?? p.lease_type),
    }),
    validate: () => [],
  },
  RENT_ROLL: {
    kind: "RENT_ROLL",
    label: "Rent Roll",
    category: "Rental",
    purpose: "Rental Income",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "45 Rental Ave, Toronto, ON" },
      { name: "numberOfUnits", label: "Number of Units", type: "number", sample: 6 },
      { name: "vacantUnits", label: "Vacant Units", type: "number", sample: 0 },
      { name: "totalMonthlyRent", label: "Total Monthly Rent", type: "number", sample: 13200 },
      { name: "asOfDate", label: "As-Of Date", type: "text", sample: "2026-06-01" },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      numberOfUnits: num(p.numberOfUnits ?? p.number_of_units),
      vacantUnits: num(p.vacantUnits ?? p.vacant_units),
      totalMonthlyRent: num(p.totalMonthlyRent ?? p.total_monthly_rent),
      asOfDate: str(p.asOfDate ?? p.as_of_date),
    }),
    validate: (e) => {
      const units = num(e.numberOfUnits);
      const vacant = num(e.vacantUnits);
      return units > 0 && vacant / units > 0.2
        ? [{
            code: "RENT-ROLL-HIGH-VACANCY",
            label: "Vacancy rate exceeds 20% on rent roll",
            severity: "WARNING",
            detail: `${vacant} of ${units} units vacant — confirm rental income sustainability.`,
            sourceDoc: "RENT_ROLL",
            penaltyPoints: 10,
          }]
        : [];
    },
  },
  PROPERTY_MANAGEMENT_AGREEMENT: {
    kind: "PROPERTY_MANAGEMENT_AGREEMENT",
    label: "Property Management Agreement",
    category: "Rental",
    purpose: "Rental Income",
    fields: [
      { name: "managementCompany", label: "Management Company", type: "text", sample: "GTA Property Management Inc." },
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "45 Rental Ave, Toronto, ON" },
      { name: "managementFeePercent", label: "Management Fee (%)", type: "number", sample: 8 },
      { name: "agreementStartDate", label: "Agreement Start Date", type: "text", sample: "2026-01-01" },
    ],
    extract: (p) => ({
      managementCompany: str(p.managementCompany ?? p.management_company),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      managementFeePercent: num(p.managementFeePercent ?? p.management_fee_percent),
      agreementStartDate: str(p.agreementStartDate ?? p.agreement_start_date),
    }),
    validate: () => [],
  },
  // NOTE: not previously present despite being requested as "(retain)" —
  // T776 does not appear anywhere in the prior 31-kind registry. Added here
  // as new, not retained; flagged in the delivery summary.
  T776: {
    kind: "T776",
    label: "T776 — Statement of Real Estate Rentals",
    category: "Rental",
    purpose: "Rental Income",
    fields: [
      F.taxpayer,
      F.taxYear,
      { name: "propertyAddress", label: "Rental Property Address", type: "text", sample: "45 Rental Ave, Toronto, ON" },
      { name: "grossRentalIncome", label: "Gross Rental Income", type: "number", sample: 28800 },
      { name: "netRentalIncome", label: "Net Rental Income", type: "number", sample: 9200 },
    ],
    extract: (p) => ({
      taxpayerName: str(p.taxpayerName ?? p.taxpayer_name),
      taxYear: num(p.taxYear ?? p.tax_year),
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      grossRentalIncome: num(p.grossRentalIncome ?? p.gross_rental_income),
      netRentalIncome: num(p.netRentalIncome ?? p.net_rental_income),
    }),
    validate: (e) =>
      num(e.netRentalIncome) < 0
        ? [{
            code: "T776-NET-RENTAL-LOSS",
            label: "T776 reports a net rental loss",
            severity: "WARNING",
            detail: `Net rental income = ${fmt(num(e.netRentalIncome))}.`,
            sourceDoc: "T776",
            penaltyPoints: 5,
          }]
        : [],
  },

  // ────────── SPECIALIZED LENDING ──────────
  CONSTRUCTION_BUDGET: {
    kind: "CONSTRUCTION_BUDGET",
    label: "Construction Budget",
    category: "Specialized Lending",
    purpose: "Construction Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "12 Build Ln, Caledon, ON" },
      { name: "totalBudget", label: "Total Budget", type: "number", sample: 620000 },
      { name: "hardCosts", label: "Hard Costs", type: "number", sample: 480000 },
      { name: "softCosts", label: "Soft Costs", type: "number", sample: 90000 },
      { name: "contingencyPercent", label: "Contingency (%)", type: "number", sample: 8 },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      totalBudget: num(p.totalBudget ?? p.total_budget),
      hardCosts: num(p.hardCosts ?? p.hard_costs),
      softCosts: num(p.softCosts ?? p.soft_costs),
      contingencyPercent: num(p.contingencyPercent ?? p.contingency_percent),
    }),
    validate: (e) =>
      num(e.contingencyPercent) < 5
        ? [{
            code: "CONSTRUCTION-LOW-CONTINGENCY",
            label: "Construction budget contingency below 5%",
            severity: "WARNING",
            detail: `Contingency of ${num(e.contingencyPercent)}% — confirm cost-overrun risk.`,
            sourceDoc: "CONSTRUCTION_BUDGET",
            penaltyPoints: 10,
          }]
        : [],
  },
  BUILDING_PERMIT: {
    kind: "BUILDING_PERMIT",
    label: "Building Permit",
    category: "Specialized Lending",
    purpose: "Construction Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "12 Build Ln, Caledon, ON" },
      { name: "permitNumber", label: "Permit Number", type: "text", sample: "BP-2026-0451" },
      { name: "issuingMunicipality", label: "Issuing Municipality", type: "text", sample: "Town of Caledon" },
      { name: "issueDate", label: "Issue Date", type: "text", sample: "2026-02-01" },
      { name: "permitType", label: "Permit Type", type: "text", sample: "New Construction" },
      { name: "status", label: "Status", type: "text", sample: "Issued", hint: "Issued | Closed | Expired" },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      permitNumber: str(p.permitNumber ?? p.permit_number),
      issuingMunicipality: str(p.issuingMunicipality ?? p.issuing_municipality),
      issueDate: str(p.issueDate ?? p.issue_date),
      permitType: str(p.permitType ?? p.permit_type),
      status: str(p.status),
    }),
    validate: (e) =>
      str(e.status).toLowerCase() === "expired"
        ? [{
            code: "BUILDING-PERMIT-EXPIRED",
            label: "Building permit expired",
            severity: "WARNING",
            detail: "Confirm renewal or closure status of the building permit.",
            sourceDoc: "BUILDING_PERMIT",
            penaltyPoints: 10,
          }]
        : [],
  },
  NEW_HOME_WARRANTY: {
    kind: "NEW_HOME_WARRANTY",
    label: "New Home Warranty Enrollment",
    category: "Specialized Lending",
    purpose: "Construction Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "45 New Estate Dr, Milton, ON" },
      { name: "warrantyProvider", label: "Warranty Provider", type: "text", sample: "Tarion" },
      { name: "enrollmentNumber", label: "Enrollment Number", type: "text", sample: "TAR-889213" },
      { name: "builderName", label: "Builder Name", type: "text", sample: "Mattamy Homes" },
      { name: "coverageStartDate", label: "Coverage Start Date", type: "text", sample: "2027-03-01" },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      warrantyProvider: str(p.warrantyProvider ?? p.warranty_provider),
      enrollmentNumber: str(p.enrollmentNumber ?? p.enrollment_number),
      builderName: str(p.builderName ?? p.builder_name),
      coverageStartDate: str(p.coverageStartDate ?? p.coverage_start_date),
    }),
    validate: () => [],
  },
  BLUEPRINTS: {
    kind: "BLUEPRINTS",
    label: "Blueprints / Architectural Plans",
    category: "Specialized Lending",
    purpose: "Construction Verification",
    fields: [
      { name: "propertyAddress", label: "Property Address", type: "text", sample: "12 Build Ln, Caledon, ON" },
      { name: "architectName", label: "Architect Name", type: "text", sample: "Jordan Lee Architects" },
      { name: "planDate", label: "Plan Date", type: "text", sample: "2025-11-15" },
      { name: "squareFootage", label: "Square Footage", type: "number", sample: 3200 },
    ],
    extract: (p) => ({
      propertyAddress: str(p.propertyAddress ?? p.property_address),
      architectName: str(p.architectName ?? p.architect_name),
      planDate: str(p.planDate ?? p.plan_date),
      squareFootage: num(p.squareFootage ?? p.square_footage),
    }),
    validate: () => [],
  },
  REVERSE_MORTGAGE_DISCLOSURE: {
    kind: "REVERSE_MORTGAGE_DISCLOSURE",
    label: "Reverse Mortgage Client Disclosure",
    category: "Specialized Lending",
    purpose: "Compliance",
    fields: [
      { name: "borrowerName", label: "Borrower Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "lenderName", label: "Lender Name", type: "text", sample: "HomeEquity Bank" },
      { name: "principalAmount", label: "Principal Amount", type: "number", sample: 180000 },
      { name: "interestRate", label: "Interest Rate (%)", type: "number", sample: 7.5 },
      { name: "disclosureDate", label: "Disclosure Date", type: "text", sample: "2026-05-01" },
      { name: "independentAdviceConfirmed", label: "Independent Advice Confirmed?", type: "boolean", sample: true },
    ],
    extract: (p) => ({
      borrowerName: str(p.borrowerName ?? p.borrower_name),
      lenderName: str(p.lenderName ?? p.lender_name),
      principalAmount: num(p.principalAmount ?? p.principal_amount),
      interestRate: num(p.interestRate ?? p.interest_rate),
      disclosureDate: str(p.disclosureDate ?? p.disclosure_date),
      independentAdviceConfirmed: bool(p.independentAdviceConfirmed ?? p.independent_advice_confirmed),
    }),
    validate: (e) =>
      bool(e.independentAdviceConfirmed)
        ? []
        : [{
            code: "REVERSE-MORTGAGE-NO-ILA",
            label: "Reverse mortgage disclosure missing independent advice confirmation",
            severity: "CRITICAL",
            detail: "Confirmation of independent legal/financial advice is required by regulation before proceeding.",
            sourceDoc: "REVERSE_MORTGAGE_DISCLOSURE",
            penaltyPoints: 30,
          }],
  },
  EXIT_STRATEGY_LETTER: {
    kind: "EXIT_STRATEGY_LETTER",
    label: "Exit Strategy Letter",
    category: "Specialized Lending",
    purpose: "Compliance",
    fields: [
      { name: "borrowerName", label: "Borrower Name", type: "text", sample: "Mujeeb Minhas" },
      { name: "exitRoute", label: "Exit Route", type: "text", sample: "Sale", hint: "Sale | Refinance | Income Improvement" },
      { name: "targetDate", label: "Target Date", type: "text", sample: "2027-06-01" },
      { name: "narrative", label: "Narrative", type: "text", sample: "Property to be listed for sale within 12 months." },
    ],
    extract: (p) => ({
      borrowerName: str(p.borrowerName ?? p.borrower_name),
      exitRoute: str(p.exitRoute ?? p.exit_route),
      targetDate: str(p.targetDate ?? p.target_date),
      narrative: str(p.narrative),
    }),
    validate: (e) =>
      !str(e.targetDate)
        ? [{
            code: "EXIT-STRATEGY-NO-TARGET-DATE",
            label: "Exit strategy letter missing target date",
            severity: "WARNING",
            detail: "Confirm a specific target date for the exit route with the borrower.",
            sourceDoc: "EXIT_STRATEGY_LETTER",
            penaltyPoints: 5,
          }]
        : [],
  },

  // ────────── BROKER WORKFLOW ──────────
  // BROKER_NOTES is a minimal stub — see delivery summary "needs discussion":
  // the app already has a native, structured file_notes feature
  // (FileNotesPanel) for broker note-taking; this kind exists only to cover
  // an uploaded/scanned notes document, and its long-term value vs. simply
  // using file_notes is worth revisiting before relying on it.
  BROKER_NOTES: {
    kind: "BROKER_NOTES",
    label: "Broker Notes",
    category: "Broker Workflow",
    purpose: "Supporting Information",
    fields: [
      { name: "noteDate", label: "Note Date", type: "text", sample: "2026-06-01" },
      { name: "authorName", label: "Author", type: "text", sample: "Jordan Lee" },
      { name: "summary", label: "Summary", type: "text", sample: "Client confirmed down payment source by phone." },
    ],
    extract: (p) => ({
      noteDate: str(p.noteDate ?? p.note_date),
      authorName: str(p.authorName ?? p.author_name),
      summary: str(p.summary),
    }),
    validate: () => [],
  },
  MORTGAGE_COMMITMENT_LETTER: {
    kind: "MORTGAGE_COMMITMENT_LETTER",
    label: "Mortgage Commitment Letter",
    category: "Broker Workflow",
    purpose: "Supporting Information",
    fields: [
      { name: "lenderName", label: "Lender Name", type: "text", sample: "TD Canada Trust" },
      { name: "loanAmount", label: "Loan Amount", type: "number", sample: 680000 },
      { name: "rate", label: "Rate (%)", type: "number", sample: 4.89 },
      { name: "term", label: "Term (months)", type: "number", sample: 60 },
      { name: "commitmentExpiryDate", label: "Commitment Expiry Date", type: "text", sample: "2026-09-01" },
      { name: "conditions", label: "Conditions", type: "text", sample: "Subject to satisfactory appraisal" },
    ],
    extract: (p) => ({
      lenderName: str(p.lenderName ?? p.lender_name),
      loanAmount: num(p.loanAmount ?? p.loan_amount),
      rate: num(p.rate),
      term: num(p.term),
      commitmentExpiryDate: str(p.commitmentExpiryDate ?? p.commitment_expiry_date),
      conditions: str(p.conditions),
    }),
    validate: (e) => {
      const days = daysUntil(e.commitmentExpiryDate);
      return days != null && days < 0
        ? [{
            code: "COMMITMENT-LETTER-EXPIRED",
            label: "Commitment letter has expired",
            severity: "WARNING",
            detail: `Commitment expired ${Math.abs(days)} day(s) ago.`,
            sourceDoc: "MORTGAGE_COMMITMENT_LETTER",
            penaltyPoints: 10,
          }]
        : [];
    },
  },
  MORTGAGE_RENEWAL_OFFER: {
    kind: "MORTGAGE_RENEWAL_OFFER",
    label: "Mortgage Renewal Offer",
    category: "Broker Workflow",
    purpose: "Supporting Information",
    fields: [
      { name: "lenderName", label: "Lender Name", type: "text", sample: "TD Canada Trust" },
      { name: "currentBalance", label: "Current Balance", type: "number", sample: 412000 },
      { name: "offeredRate", label: "Offered Rate (%)", type: "number", sample: 4.49 },
      { name: "offeredTerm", label: "Offered Term (months)", type: "number", sample: 60 },
      { name: "maturityDate", label: "Maturity Date", type: "text", sample: "2026-10-01" },
    ],
    extract: (p) => ({
      lenderName: str(p.lenderName ?? p.lender_name),
      currentBalance: num(p.currentBalance ?? p.current_balance),
      offeredRate: num(p.offeredRate ?? p.offered_rate),
      offeredTerm: num(p.offeredTerm ?? p.offered_term),
      maturityDate: str(p.maturityDate ?? p.maturity_date),
    }),
    validate: () => [],
  },
  EXISTING_APPROVAL_LETTER: {
    kind: "EXISTING_APPROVAL_LETTER",
    label: "Existing Approval Letter",
    category: "Broker Workflow",
    purpose: "Supporting Information",
    fields: [
      { name: "lenderName", label: "Lender Name", type: "text", sample: "Scotiabank" },
      { name: "approvedAmount", label: "Approved Amount", type: "number", sample: 675000 },
      { name: "rate", label: "Rate (%)", type: "number", sample: 4.94 },
      { name: "approvalDate", label: "Approval Date", type: "text", sample: "2026-06-10" },
      { name: "expiryDate", label: "Expiry Date", type: "text", sample: "2026-09-10" },
    ],
    extract: (p) => ({
      lenderName: str(p.lenderName ?? p.lender_name),
      approvedAmount: num(p.approvedAmount ?? p.approved_amount),
      rate: num(p.rate),
      approvalDate: str(p.approvalDate ?? p.approval_date),
      expiryDate: str(p.expiryDate ?? p.expiry_date),
    }),
    validate: () => [],
  },
  LENDER_CONDITIONS_LETTER: {
    kind: "LENDER_CONDITIONS_LETTER",
    label: "Lender Conditions Letter",
    category: "Broker Workflow",
    purpose: "Supporting Information",
    fields: [
      { name: "lenderName", label: "Lender Name", type: "text", sample: "TD Canada Trust" },
      { name: "dealReferenceNumber", label: "Deal Reference Number", type: "text", sample: "DL-8827341" },
      { name: "conditionsList", label: "Conditions", type: "text", sample: "Confirm source of down payment; provide updated pay stub" },
      { name: "conditionsDueDate", label: "Conditions Due Date", type: "text", sample: "2026-08-01" },
    ],
    extract: (p) => ({
      lenderName: str(p.lenderName ?? p.lender_name),
      dealReferenceNumber: str(p.dealReferenceNumber ?? p.deal_reference_number),
      conditionsList: str(p.conditionsList ?? p.conditions_list ?? p.conditions),
      conditionsDueDate: str(p.conditionsDueDate ?? p.conditions_due_date),
    }),
    validate: () => [],
  },
};

// ────────────────────────────────────────────────────────────────────────────────
// Category index (computed from registry — single source of truth)
// ────────────────────────────────────────────────────────────────────────────────

export const CATEGORY_ORDER: DocumentCategory[] = [
  "Core Returns",
  "T4 Family",
  "Investments",
  "Specialized",
  "Super-Priority",
  "Sub-Schedules",
  "Identity",
  "Legal",
  "Corporate",
  "Income",
  "Assets",
  "Property",
  "Liabilities",
  "Credit",
  "Rental",
  "Specialized Lending",
  "Broker Workflow",
];

export function getRegistryByCategory(): Record<DocumentCategory, DocumentKind[]> {
  const out = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, [] as DocumentKind[]])) as Record<
    DocumentCategory,
    DocumentKind[]
  >;
  (Object.keys(DocumentRegistry) as DocumentKind[]).forEach((k) => {
    out[DocumentRegistry[k].category].push(k);
  });
  return out;
}

// ────────────────────────────────────────────────────────────────────────────────
// Processing
// ────────────────────────────────────────────────────────────────────────────────

export function processDocument(doc: RawDocument): ProcessedDocument {
  const entry = DocumentRegistry[doc.kind];
  if (!entry) {
    return {
      kind: doc.kind,
      applicantId: doc.applicantId,
      source: doc.source,
      extracted: {},
      alerts: [{
        code: "DOC-UNKNOWN-TYPE",
        label: `Unknown document type "${doc.kind}"`,
        severity: "WARNING",
        detail: "No registry entry matched. Routed to manual review queue.",
        sourceDoc: doc.kind,
        penaltyPoints: 0,
      }],
    };
  }
  const extracted = entry.extract(doc.payload ?? {});
  const primary = entry.validate(extracted);
  const superPriority = runSuperPriorityChecks(doc.kind, extracted);
  const seen = new Set<string>();
  const alerts = [...primary, ...superPriority].filter((a) => {
    if (seen.has(a.code)) return false;
    seen.add(a.code);
    return true;
  });
  return { kind: doc.kind, applicantId: doc.applicantId, source: doc.source, extracted, alerts };
}

export function processDocuments(docs: RawDocument[]): ProcessedDocument[] {
  return docs.map(processDocument);
}

export function runSuperPriorityChecks(
  kind: DocumentKind,
  extracted: ExtractedFields,
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  if (kind === "PD7A" || kind === "RC59") {
    const arrears = num(extracted.outstanding_deductions);
    if (arrears > 0) {
      alerts.push({
        code: "HIGH_RISK_LIEN_ALERT",
        label: "Outstanding CRA payroll source deductions",
        severity: "HIGH",
        detail: `${fmt(arrears)} unremitted source deductions on ${kind}. CRA Crown super-priority (ITA s.227(4.1)) ranks ahead of mortgage security.`,
        sourceDoc: kind,
        penaltyPoints: 30,
        superPriority: true,
      });
    }
  }
  if (kind === "NET34") {
    const unremitted = Math.max(num(extracted.unremitted_sales_tax), num(extracted.net_tax_owing));
    if (unremitted > 0) {
      alerts.push({
        code: "CRITICAL_CROWN_CHARGE",
        label: "Unremitted GST/HST — deemed-trust Crown charge",
        severity: "CRITICAL",
        detail: `${fmt(unremitted)} unremitted sales tax on NET34. ETA s.222 deemed trust takes priority over conventional mortgage security. Funding BLOCKED.`,
        sourceDoc: kind,
        penaltyPoints: 50,
        superPriority: true,
      });
    }
  }
  return alerts;
}

export interface ComplianceVerdict {
  blocking: boolean;
  highestSeverity: ComplianceSeverity | null;
  alerts: ComplianceAlert[];
  superPriorityAlerts: ComplianceAlert[];
  totalPenalty: number;
}

const SEV_RANK: Record<ComplianceSeverity, number> = { INFO: 0, WARNING: 1, HIGH: 2, CRITICAL: 3 };

export function aggregateCompliance(processed: ProcessedDocument[]): ComplianceVerdict {
  const alerts = processed.flatMap((d) => d.alerts);
  const superPriorityAlerts = alerts.filter((a) => a.superPriority);
  const highestSeverity = alerts.reduce<ComplianceSeverity | null>((acc, a) => {
    if (acc == null) return a.severity;
    return SEV_RANK[a.severity] > SEV_RANK[acc] ? a.severity : acc;
  }, null);
  return {
    blocking: alerts.some((a) => a.severity === "CRITICAL"),
    highestSeverity,
    alerts,
    superPriorityAlerts,
    totalPenalty: alerts.reduce((sum, a) => sum + a.penaltyPoints, 0),
  };
}
