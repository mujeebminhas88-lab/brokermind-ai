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
  | "NET34";

export type DocumentCategory =
  | "Core Returns"
  | "T4 Family"
  | "Investments"
  | "Specialized"
  | "Sub-Schedules"
  | "Super-Priority";

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
  hint?: string;
}

interface RegistryEntry {
  kind: DocumentKind;
  label: string;
  category: DocumentCategory;
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

const arrearsFlag = (kind: DocumentKind, amount: number, code: string, label: string, sev: ComplianceSeverity, pts: number): ComplianceAlert[] =>
  amount > 0
    ? [{ code, label, severity: sev, detail: `${fmt(amount)} outstanding on ${kind}.`, sourceDoc: kind, penaltyPoints: pts }]
    : [];

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
