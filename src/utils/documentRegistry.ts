/**
 * BrokerMindAI — Document Compliance Engine
 *
 * Encodes the firm's document taxonomy as a registry of extractors + validators
 * and exposes a "Super Priority" risk-checking pass that runs at every
 * document intake. Output is consumed by the dashboard to surface
 * Compliance Alert banners next to the affected applicant.
 *
 * This module is pure logic — no UI, no I/O. It is safe to call from both
 * client components and server functions.
 */

// ────────────────────────────────────────────────────────────────────────────────
// Taxonomy
// ────────────────────────────────────────────────────────────────────────────────

export type DocumentKind =
  // Corporate
  | "T2"
  | "T2_SCH1"
  | "T2_SCH100"
  | "T2_SCH125"
  // Sole Prop
  | "T1"
  | "T2125"
  // Partnership
  | "T5013"
  // Revenue verification
  | "T4A"
  | "T1204"
  // CRA notices
  | "NOA"
  // Super-priority sources
  | "PD7A"
  | "RC59"
  | "NET34" // GST/HST return
  ;

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
  // Free-form payload — registry extractors stamp typed fields here.
  [key: string]: number | string | boolean | null | undefined;
}

export interface RawDocument {
  kind: DocumentKind;
  /** Caller-supplied parsed payload (OCR / manual entry / API ingest). */
  payload: Record<string, unknown>;
  /** Optional: applicant the document belongs to. */
  applicantId?: string;
  /** Optional: filename / external reference for audit. */
  source?: string;
}

export interface ProcessedDocument {
  kind: DocumentKind;
  applicantId?: string;
  source?: string;
  extracted: ExtractedFields;
  alerts: ComplianceAlert[];
}

interface RegistryEntry {
  kind: DocumentKind;
  label: string;
  /** Pull canonical fields out of the raw payload. */
  extract: (payload: Record<string, unknown>) => ExtractedFields;
  /** Domain-specific validations producing compliance alerts. */
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

// ────────────────────────────────────────────────────────────────────────────────
// The Registry — single source of truth for extract + validate per doc kind
// ────────────────────────────────────────────────────────────────────────────────

export const DocumentRegistry: Record<DocumentKind, RegistryEntry> = {
  // ── Corporate (T2 family) ────────────────────────────────────────────────
  T2: {
    kind: "T2",
    label: "T2 Corporation Income Tax Return",
    extract: (p) => ({
      corporationName: str(p.corporationName ?? p.corporation_name),
      taxYear: num(p.taxYear ?? p.tax_year),
      businessNumber: str(p.businessNumber ?? p.business_number),
    }),
    validate: () => [],
  },
  T2_SCH1: {
    kind: "T2_SCH1",
    label: "T2 Schedule 1 — Net Income (Loss) for Income Tax Purposes",
    extract: (p) => ({
      netIncomeForTax: num(p.netIncomeForTax ?? p.line_9999),
    }),
    validate: () => [],
  },
  T2_SCH100: {
    kind: "T2_SCH100",
    label: "T2 Schedule 100 — Balance Sheet (GIFI)",
    extract: (p) => ({
      // GIFI 2599 — Total assets
      field_2599_total_assets: num(p.field_2599 ?? p.totalAssets),
      // GIFI 3499 — Total liabilities
      field_3499_total_liabilities: num(p.field_3499 ?? p.totalLiabilities),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const assets = num(e.field_2599_total_assets);
      const liab = num(e.field_3499_total_liabilities);
      if (liab > assets && assets > 0) {
        alerts.push({
          code: "CORP-BALANCE-SHEET-INSOLVENT",
          label: "Total liabilities exceed total assets (GIFI 3499 > 2599)",
          severity: "HIGH",
          detail: `Assets ${fmt(assets)} vs Liabilities ${fmt(liab)} — technical insolvency on the operating company.`,
          sourceDoc: "T2_SCH100",
          penaltyPoints: 20,
        });
      }
      return alerts;
    },
  },
  T2_SCH125: {
    kind: "T2_SCH125",
    label: "T2 Schedule 125 — Income Statement (GIFI)",
    extract: (p) => ({
      // GIFI 8299 — Total revenue
      field_8299_total_revenue: num(p.field_8299 ?? p.totalRevenue),
      // GIFI 9369 — Net income before tax
      field_9369_net_income: num(p.field_9369 ?? p.netIncomeBeforeTax),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      if (num(e.field_9369_net_income) < 0) {
        alerts.push({
          code: "CORP-NET-LOSS",
          label: "Operating company reported a net loss (GIFI 9369 < 0)",
          severity: "WARNING",
          detail: `Net income before tax = ${fmt(num(e.field_9369_net_income))}.`,
          sourceDoc: "T2_SCH125",
          penaltyPoints: 5,
        });
      }
      return alerts;
    },
  },

  // ── Sole Prop (T1 + T2125) ───────────────────────────────────────────────
  T1: {
    kind: "T1",
    label: "T1 Personal Income Tax Return",
    extract: (p) => ({
      taxpayerName: str(p.taxpayerName ?? p.taxpayer_name),
      taxYear: num(p.taxYear ?? p.tax_year),
      line_13500_net_biz_income: num(p.line13500 ?? p.line_13500SelfEmployment ?? p.line_13500),
      line_15000_total_income: num(p.line15000 ?? p.line_15000TotalIncome ?? p.line_15000),
      line_23600_net_income: num(p.line23600 ?? p.line_23600NetIncome ?? p.line_23600),
    }),
    validate: () => [],
  },
  T2125: {
    kind: "T2125",
    label: "T2125 Statement of Business / Professional Activities",
    extract: (p) => ({
      businessName: str(p.businessName ?? p.business_name),
      // Part 1 — Business income
      part1_gross: num(p.part1Gross ?? p.grossBusinessIncome ?? p.part_1_gross),
      // Part 5 — Net income (loss) after adjustments
      part5_net: num(p.part5Net ?? p.netBusinessIncome ?? p.part_5_net),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const gross = num(e.part1_gross);
      const net = num(e.part5_net);
      if (gross > 0 && net / gross > 0.95) {
        alerts.push({
          code: "SOLE-PROP-MARGIN-OUTLIER",
          label: "Reported margin >95% on T2125 — verify expense capture",
          severity: "WARNING",
          detail: `Part 5 net ${fmt(net)} on Part 1 gross ${fmt(gross)}.`,
          sourceDoc: "T2125",
          penaltyPoints: 5,
        });
      }
      return alerts;
    },
  },

  // ── Partnership (T5013) ──────────────────────────────────────────────────
  T5013: {
    kind: "T5013",
    label: "T5013 Statement of Partnership Income",
    extract: (p) => ({
      // Boxes 010 / 020 — partnership identifiers
      box_010_partnership_acct: str(p.box010 ?? p.box_010),
      box_020_total_units: num(p.box020 ?? p.box_020),
      // Boxes 116 / 122 — partner's share
      box_116_partner_share_business: num(p.box116 ?? p.box_116),
      box_122_partner_share_rental: num(p.box122 ?? p.box_122),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      if (!str(e.box_010_partnership_acct)) {
        alerts.push({
          code: "PART-MISSING-REGISTRATION",
          label: "T5013 missing partnership account number (Box 010)",
          severity: "WARNING",
          detail: "Cannot verify CRA registration of the partnership.",
          sourceDoc: "T5013",
          penaltyPoints: 5,
        });
      }
      return alerts;
    },
  },

  // ── Revenue Verification ────────────────────────────────────────────────
  T4A: {
    kind: "T4A",
    label: "T4A Statement of Pension, Retirement, Annuity & Other Income",
    extract: (p) => ({
      payerName: str(p.payerName ?? p.payer_name),
      box_048_fees_for_services: num(p.box048 ?? p.box_048FeesForServices ?? p.box_048),
    }),
    validate: () => [],
  },
  T1204: {
    kind: "T1204",
    label: "T1204 Government Service Contract Payments",
    extract: (p) => ({
      // Box 82 — Services portion, Box 84 — Total
      box_82_service_payments: num(p.box82 ?? p.box_82),
      box_84_total_payments: num(p.box84 ?? p.box_84),
    }),
    validate: () => [],
  },

  // ── CRA Notice of Assessment ────────────────────────────────────────────
  NOA: {
    kind: "NOA",
    label: "CRA Notice of Assessment",
    extract: (p) => ({
      taxpayerName: str(p.taxpayer_name ?? p.taxpayerName),
      taxYear: num(p.tax_year ?? p.taxYear),
      line_15000_total_income: num(p.line_15000_total_income ?? p.line15000),
      line_23600_net_income: num(p.line_23600_net_income ?? p.line23600),
      balance_owing: num(p.balance_owing_at_assessment ?? p.balanceOwing ?? p.balance_owing),
      has_arrears: bool(p.has_unarranged_arrears ?? p.hasArrears ?? p.has_arrears),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const owing = num(e.balance_owing);
      if (owing > 0 || bool(e.has_arrears)) {
        alerts.push({
          code: "CRA-BALANCE-OWING",
          label: "CRA balance owing / tax liability on NOA",
          severity: "HIGH",
          detail: `NOA reports ${fmt(owing)} outstanding to CRA${bool(e.has_arrears) ? " (unarranged arrears flagged)" : ""}.`,
          sourceDoc: "NOA",
          penaltyPoints: 20,
        });
      }
      return alerts;
    },
  },

  // ── Super-Priority Sources ──────────────────────────────────────────────
  PD7A: {
    kind: "PD7A",
    label: "PD7A — Statement of Account for Current Source Deductions",
    extract: (p) => ({
      payrollAccount: str(p.payrollAccount ?? p.account_number),
      outstanding_deductions: num(p.outstandingDeductions ?? p.amount_owing ?? p.balance),
      reporting_period: str(p.period ?? p.reporting_period),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const arrears = num(e.outstanding_deductions);
      if (arrears > 0) {
        alerts.push({
          code: "HIGH_RISK_LIEN_ALERT",
          label: "Unremitted CRA payroll source deductions (PD7A)",
          severity: "HIGH",
          detail: `PD7A shows ${fmt(arrears)} in outstanding source deductions. Statutory super-priority Crown lien risk — ranks ahead of mortgage security.`,
          sourceDoc: "PD7A",
          penaltyPoints: 30,
          superPriority: true,
        });
      }
      return alerts;
    },
  },
  RC59: {
    kind: "RC59",
    label: "RC59 — Business Consent / Representative Authorization (payroll arrears)",
    extract: (p) => ({
      businessNumber: str(p.businessNumber ?? p.bn),
      outstanding_deductions: num(p.outstandingDeductions ?? p.amount_owing ?? p.balance),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const arrears = num(e.outstanding_deductions);
      if (arrears > 0) {
        alerts.push({
          code: "HIGH_RISK_LIEN_ALERT",
          label: "Outstanding payroll deductions disclosed via RC59 inquiry",
          severity: "HIGH",
          detail: `RC59 inquiry returned ${fmt(arrears)} owing on payroll account. Crown super-priority exposure.`,
          sourceDoc: "RC59",
          penaltyPoints: 30,
          superPriority: true,
        });
      }
      return alerts;
    },
  },
  NET34: {
    kind: "NET34",
    label: "GST/HST NETFILE Return (NET34)",
    extract: (p) => ({
      businessNumber: str(p.businessNumber ?? p.bn),
      reporting_period: str(p.period ?? p.reporting_period),
      net_tax_owing: num(p.netTaxOwing ?? p.net_tax ?? p.amount_owing),
      unremitted_sales_tax: num(p.unremittedSalesTax ?? p.unremitted_sales_tax ?? p.balance),
    }),
    validate: (e) => {
      const alerts: ComplianceAlert[] = [];
      const unremitted = Math.max(num(e.unremitted_sales_tax), num(e.net_tax_owing));
      if (unremitted > 0) {
        alerts.push({
          code: "CRITICAL_CROWN_CHARGE",
          label: "Unremitted GST/HST (deemed trust under ETA s.222)",
          severity: "CRITICAL",
          detail: `Net GST/HST owing of ${fmt(unremitted)} on NET34. Deemed-trust Crown charge — registers ahead of conventional security. ABSOLUTE BLOCK on funding until cleared.`,
          sourceDoc: "NET34",
          penaltyPoints: 50,
          superPriority: true,
        });
      }
      return alerts;
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────────
// Processing entry points
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Process a single document through extract → validate → super-priority pass.
 * The super-priority pass is a secondary scan that runs against the extracted
 * fields regardless of which registry entry produced them, so a payroll-style
 * arrears figure surfacing on an unrelated document still trips the lien
 * alert.
 */
export function processDocument(doc: RawDocument): ProcessedDocument {
  const entry = DocumentRegistry[doc.kind];
  if (!entry) {
    return {
      kind: doc.kind,
      applicantId: doc.applicantId,
      source: doc.source,
      extracted: {},
      alerts: [
        {
          code: "DOC-UNKNOWN-TYPE",
          label: `Unknown document type "${doc.kind}"`,
          severity: "WARNING",
          detail: "No registry entry matched. Routed to manual review queue.",
          sourceDoc: doc.kind,
          penaltyPoints: 0,
        },
      ],
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
  return {
    kind: doc.kind,
    applicantId: doc.applicantId,
    source: doc.source,
    extracted,
    alerts,
  };
}

export function processDocuments(docs: RawDocument[]): ProcessedDocument[] {
  return docs.map(processDocument);
}

/**
 * Super Priority Risk Engine.
 *
 * Runs at every document intake. Two statutory exposures dominate Canadian
 * mortgage adjudication because they rank AHEAD of registered mortgage
 * security:
 *
 *   1. CRA payroll source deductions (ITA s.227(4.1)) — surfaced by PD7A /
 *      RC59 inquiries → HIGH_RISK_LIEN_ALERT.
 *   2. Unremitted GST/HST under the ETA s.222 deemed-trust — surfaced by the
 *      GST/HST NETFILE return (NET34) → CRITICAL_CROWN_CHARGE.
 *
 * The function is exported standalone so the dashboard can re-run it against
 * already-extracted fields without re-parsing the source document.
 */
export function runSuperPriorityChecks(
  kind: DocumentKind,
  extracted: ExtractedFields,
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];

  // Payroll / source-deduction arrears (PD7A or RC59).
  if (kind === "PD7A" || kind === "RC59") {
    const arrears = num(extracted.outstanding_deductions);
    if (arrears > 0) {
      alerts.push({
        code: "HIGH_RISK_LIEN_ALERT",
        label: "Outstanding CRA payroll source deductions",
        severity: "HIGH",
        detail: `${fmt(arrears)} in unremitted source deductions detected on ${kind}. CRA Crown super-priority (ITA s.227(4.1)) ranks ahead of mortgage security.`,
        sourceDoc: kind,
        penaltyPoints: 30,
        superPriority: true,
      });
    }
  }

  // GST/HST unremitted sales tax (NET34).
  if (kind === "NET34") {
    const unremitted = Math.max(
      num(extracted.unremitted_sales_tax),
      num(extracted.net_tax_owing),
    );
    if (unremitted > 0) {
      alerts.push({
        code: "CRITICAL_CROWN_CHARGE",
        label: "Unremitted GST/HST — deemed-trust Crown charge",
        severity: "CRITICAL",
        detail: `${fmt(unremitted)} unremitted sales tax on NET34. ETA s.222 deemed trust takes priority over conventional mortgage security. Funding BLOCKED until cleared.`,
        sourceDoc: kind,
        penaltyPoints: 50,
        superPriority: true,
      });
    }
  }

  return alerts;
}

/**
 * Aggregate the alerts of an applicant's full document set into a single
 * compliance verdict the UI can render as a banner.
 */
export interface ComplianceVerdict {
  blocking: boolean;
  highestSeverity: ComplianceSeverity | null;
  alerts: ComplianceAlert[];
  superPriorityAlerts: ComplianceAlert[];
  totalPenalty: number;
}

const SEV_RANK: Record<ComplianceSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  HIGH: 2,
  CRITICAL: 3,
};

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
