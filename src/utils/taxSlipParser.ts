import { z } from "zod";

/**
 * Phase 4 — Tax Slip Suite
 *
 * Zod-validated parsers for the four Canadian source documents we adjudicate against:
 *   • T4    — Statement of Remuneration Paid (employment income)
 *   • T1    — Personal income tax return (line items)
 *   • T2125 — Statement of Business/Professional Activities (self-employed)
 *   • T4A   — Statement of Pension, Retirement, Annuity & Other Income
 *
 * Plus a CROSS-DOCUMENT FORENSIC VARIANCE engine that reconciles declared income across
 * sources and surfaces material inconsistencies as risk flags consumable by the
 * aggregate scoring matrix.
 */

// ────────────────────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────────────────────

const yearSchema = z.number().int().min(2000).max(new Date().getFullYear());
const moneySchema = z.number().nonnegative().finite();

export const t4Schema = z.object({
  docType: z.literal("T4"),
  taxYear: yearSchema,
  employerName: z.string().min(1),
  employerBN: z.string().optional(),
  box14EmploymentIncome: moneySchema,
  box16CPP: moneySchema.default(0),
  box18EI: moneySchema.default(0),
  box22IncomeTaxDeducted: moneySchema.default(0),
  box40OtherTaxableAllowances: moneySchema.default(0),
});

export const t1Schema = z.object({
  docType: z.literal("T1"),
  taxYear: yearSchema,
  taxpayerName: z.string().min(1),
  line10100Employment: moneySchema.default(0),
  line13500SelfEmployment: moneySchema.default(0),
  line12600RentalNet: moneySchema.default(0),
  line11500Pension: moneySchema.default(0),
  line15000TotalIncome: moneySchema,
  line23600NetIncome: moneySchema,
  line26000TaxableIncome: moneySchema,
  balanceOwing: moneySchema.default(0),
});

export const t2125Schema = z.object({
  docType: z.literal("T2125"),
  taxYear: yearSchema,
  businessName: z.string().min(1),
  industryCode: z.string().optional(),
  grossBusinessIncome: moneySchema,
  totalBusinessExpenses: moneySchema,
  netBusinessIncome: z.number().finite(), // can be negative
});

export const t4aSchema = z.object({
  docType: z.literal("T4A"),
  taxYear: yearSchema,
  payerName: z.string().min(1),
  box016Pension: moneySchema.default(0),
  box020SelfEmpCommissions: moneySchema.default(0),
  box048FeesForServices: moneySchema.default(0),
  box105Scholarships: moneySchema.default(0),
});

/**
 * T2 — Corporation Income Tax Return.
 * Captures the corporate-side line items needed to forensically reconcile an
 * incorporated borrower's personal declaration (T1) against the operating
 * company's books, and to surface shadow debt via the shareholder loan account.
 */
export const t2Schema = z.object({
  docType: z.literal("T2"),
  taxYear: yearSchema,
  corporationName: z.string().min(1),
  businessNumber: z.string().optional(),
  grossRevenue: moneySchema,
  netIncomeBeforeTax: z.number().finite(), // GIFI 9970 — can be negative
  retainedEarnings: z.number().finite(),   // GIFI 3849 — can be negative
  shareholderLoanReceivable: z.number().finite().default(0), // GIFI 2360 (asset = corp lent TO shareholder)
  shareholderLoanPayable: moneySchema.default(0),            // GIFI 3140 (liability = corp owes shareholder)
  dividendsPaidToShareholder: moneySchema.default(0),
  managementSalaryToOwner: moneySchema.default(0),
  ownershipPct: z.number().min(0).max(100).default(100),
});

export const taxSlipSchema = z.discriminatedUnion("docType", [
  t4Schema,
  t1Schema,
  t2125Schema,
  t4aSchema,
  t2Schema,
]);

export type T4 = z.infer<typeof t4Schema>;
export type T1 = z.infer<typeof t1Schema>;
export type T2125 = z.infer<typeof t2125Schema>;
export type T4A = z.infer<typeof t4aSchema>;
export type T2 = z.infer<typeof t2Schema>;
export type TaxSlip = z.infer<typeof taxSlipSchema>;


// ────────────────────────────────────────────────────────────────────────────────
// Variance engine
// ────────────────────────────────────────────────────────────────────────────────

export type VarianceSeverity = "INFO" | "MINOR" | "MATERIAL" | "CRITICAL";

export interface VarianceFlag {
  code: string;
  label: string;
  severity: VarianceSeverity;
  detail: string;
  penaltyPoints: number;
  affectedDocs: TaxSlip["docType"][];
}

export interface VarianceReport {
  taxYear: number | null;
  declaredEmployment: number;
  reconstructedEmployment: number;
  declaredSelfEmployment: number;
  reconstructedSelfEmployment: number;
  declaredTotalIncome: number;
  reconstructedTotalIncome: number;
  variancePct: number;
  flags: VarianceFlag[];
  penaltyTotal: number;
}

const MATERIALITY_PCT = 0.05; // 5% spread = MINOR, 10% = MATERIAL, 20%+ = CRITICAL
const TOL_DOLLARS = 50; // sub-$50 absolute spread is noise

function severityFromVariance(pct: number): VarianceSeverity | null {
  const abs = Math.abs(pct);
  if (abs >= 0.2) return "CRITICAL";
  if (abs >= 0.1) return "MATERIAL";
  if (abs >= MATERIALITY_PCT) return "MINOR";
  return null;
}

function penaltyFor(severity: VarianceSeverity): number {
  switch (severity) {
    case "CRITICAL": return 25;
    case "MATERIAL": return 15;
    case "MINOR": return 5;
    default: return 0;
  }
}

/**
 * Cross-document forensic variance reconciliation.
 *
 * Compares the T1 declared totals against the sum of supporting source slips
 * (T4 employment, T2125 self-employment, T4A pension/other) for the same tax year.
 * Returns a VarianceReport with itemised flags; penaltyTotal feeds the aggregate
 * risk score in the global engine.
 */
export function reconcileTaxSlips(slips: TaxSlip[]): VarianceReport {
  const t1 = slips.find((s): s is T1 => s.docType === "T1");
  const t4s = slips.filter((s): s is T4 => s.docType === "T4");
  const t2125s = slips.filter((s): s is T2125 => s.docType === "T2125");
  const t4as = slips.filter((s): s is T4A => s.docType === "T4A");
  const t2s = slips.filter((s): s is T2 => s.docType === "T2");


  const declaredEmployment = t1?.line10100Employment ?? 0;
  const declaredSelfEmployment = t1?.line13500SelfEmployment ?? 0;
  const declaredTotalIncome = t1?.line15000TotalIncome ?? 0;

  const reconstructedEmployment =
    t4s.reduce((sum, t) => sum + t.box14EmploymentIncome + t.box40OtherTaxableAllowances, 0);
  const reconstructedSelfEmployment =
    t2125s.reduce((sum, t) => sum + t.netBusinessIncome, 0) +
    t4as.reduce((sum, t) => sum + t.box020SelfEmpCommissions + t.box048FeesForServices, 0);
  const reconstructedPension = t4as.reduce((sum, t) => sum + t.box016Pension, 0);
  const reconstructedTotalIncome =
    reconstructedEmployment + reconstructedSelfEmployment + reconstructedPension;

  const variancePct =
    declaredTotalIncome > 0
      ? (declaredTotalIncome - reconstructedTotalIncome) / declaredTotalIncome
      : 0;

  const flags: VarianceFlag[] = [];

  // Year mismatch — any slip not aligned to the T1 year
  if (t1) {
    const offYear = slips.filter((s) => s.taxYear !== t1.taxYear);
    if (offYear.length > 0) {
      flags.push({
        code: "TAX-YEAR-MISMATCH",
        label: "Tax year mismatch across source documents",
        severity: "MATERIAL",
        detail: `T1 is ${t1.taxYear}; ${offYear.length} supporting slip(s) carry a different year.`,
        penaltyPoints: penaltyFor("MATERIAL"),
        affectedDocs: Array.from(new Set(offYear.map((s) => s.docType))),
      });
    }
  }

  // Employment income variance: T1 line 10100 vs sum(T4 box 14)
  if (t1 && t4s.length > 0) {
    const diff = declaredEmployment - reconstructedEmployment;
    const pct = declaredEmployment > 0 ? diff / declaredEmployment : 0;
    if (Math.abs(diff) > TOL_DOLLARS) {
      const sev = severityFromVariance(pct);
      if (sev) {
        flags.push({
          code: "FORENSIC-T4-T1-VARIANCE",
          label: "T4 employment total ≠ T1 line 10100",
          severity: sev,
          detail: `Declared ${fmt(declaredEmployment)} vs reconstructed ${fmt(reconstructedEmployment)} (Δ ${fmt(diff)}, ${(pct * 100).toFixed(1)}%).`,
          penaltyPoints: penaltyFor(sev),
          affectedDocs: ["T1", "T4"],
        });
      }
    }
  }

  // Self-employment variance: T1 line 13500 vs T2125 + T4A self-emp boxes
  if (t1 && (t2125s.length > 0 || t4as.some((s) => s.box020SelfEmpCommissions + s.box048FeesForServices > 0))) {
    const diff = declaredSelfEmployment - reconstructedSelfEmployment;
    const pct = declaredSelfEmployment > 0 ? diff / declaredSelfEmployment : 0;
    if (Math.abs(diff) > TOL_DOLLARS) {
      const sev = severityFromVariance(pct) ?? "MINOR";
      flags.push({
        code: "FORENSIC-T2125-T1-VARIANCE",
        label: "Self-employment income ≠ T1 line 13500",
        severity: sev,
        detail: `Declared ${fmt(declaredSelfEmployment)} vs reconstructed ${fmt(reconstructedSelfEmployment)} (Δ ${fmt(diff)}).`,
        penaltyPoints: penaltyFor(sev),
        affectedDocs: ["T1", "T2125", "T4A"],
      });
    }
  }

  // Total income variance — last-line sanity check
  if (t1 && Math.abs(declaredTotalIncome - reconstructedTotalIncome) > TOL_DOLLARS) {
    const sev = severityFromVariance(variancePct);
    if (sev) {
      flags.push({
        code: "FORENSIC-TOTAL-INCOME-VARIANCE",
        label: "Aggregate income reconstruction variance",
        severity: sev,
        detail: `T1 line 15000 ${fmt(declaredTotalIncome)} vs reconstructed ${fmt(reconstructedTotalIncome)} (${(variancePct * 100).toFixed(1)}%).`,
        penaltyPoints: penaltyFor(sev),
        affectedDocs: ["T1", "T4", "T2125", "T4A"],
      });
    }
  }

  // Negative business income coupled with positive declaration → loss laundering risk
  for (const biz of t2125s) {
    if (biz.netBusinessIncome < 0 && declaredSelfEmployment > 0) {
      flags.push({
        code: "FORENSIC-BUSINESS-LOSS-OFFSET",
        label: "Net business loss reported alongside positive self-employment income",
        severity: "MATERIAL",
        detail: `${biz.businessName} reported net ${fmt(biz.netBusinessIncome)} while T1 declares ${fmt(declaredSelfEmployment)}.`,
        penaltyPoints: penaltyFor("MATERIAL"),
        affectedDocs: ["T1", "T2125"],
      });
    }
  }

  // Unsupported T1 self-employment (no T2125/T4A backing)
  if (t1 && declaredSelfEmployment > TOL_DOLLARS && t2125s.length === 0 && reconstructedSelfEmployment < TOL_DOLLARS) {
    flags.push({
      code: "DOC-MISSING-T2125",
      label: "T1 declares self-employment income with no supporting T2125 / T4A",
      severity: "MATERIAL",
      detail: `T1 line 13500 = ${fmt(declaredSelfEmployment)} but no T2125/T4A source documents supplied.`,
      penaltyPoints: penaltyFor("MATERIAL"),
      affectedDocs: ["T1"],
    });
  }

  // ── Phase 5 — T2 corporate reconciliation ────────────────────────────────
  for (const t2 of t2s) {
    const ownerShare = t2.ownershipPct / 100;

    // Shadow debt: corp lent net funds TO shareholder (asset on corp BS).
    const netLoanToShareholder = t2.shareholderLoanReceivable - t2.shareholderLoanPayable;
    if (netLoanToShareholder > TOL_DOLLARS) {
      const sev: VarianceSeverity = netLoanToShareholder > 50_000 ? "CRITICAL" : "MATERIAL";
      flags.push({
        code: "CORP-SHAREHOLDER-LOAN-DEBIT",
        label: "Shareholder loan receivable — undeclared shadow debt",
        severity: sev,
        detail: `${t2.corporationName} carries ${fmt(netLoanToShareholder)} owed BY the shareholder. CRA s.15(2) deemed-income exposure; treat as personal liability.`,
        penaltyPoints: penaltyFor(sev),
        affectedDocs: ["T2"],
      });
    }

    // Negative retained earnings — solvency / going-concern risk on the income source.
    if (t2.retainedEarnings < 0) {
      const sev: VarianceSeverity = t2.retainedEarnings < -100_000 ? "CRITICAL" : "MATERIAL";
      flags.push({
        code: "CORP-NEGATIVE-RETAINED-EARNINGS",
        label: "Operating company in accumulated deficit",
        severity: sev,
        detail: `${t2.corporationName} retained earnings = ${fmt(t2.retainedEarnings)}. Income sustainability is impaired.`,
        penaltyPoints: penaltyFor(sev),
        affectedDocs: ["T2"],
      });
    }

    // Net loss reported by the operating company.
    if (t2.netIncomeBeforeTax < -TOL_DOLLARS) {
      flags.push({
        code: "CORP-NET-LOSS-YEAR",
        label: "Corporation reported a net loss for the period",
        severity: "MINOR",
        detail: `${t2.corporationName} net income before tax = ${fmt(t2.netIncomeBeforeTax)}.`,
        penaltyPoints: penaltyFor("MINOR"),
        affectedDocs: ["T2"],
      });
    }

    // Owner-draw reconciliation: dividends + management salary attributable to owner
    // should be reflected on the personal T1 (line 10100 for salary, taxable dividends elsewhere).
    if (t1) {
      const ownerDraw =
        (t2.dividendsPaidToShareholder + t2.managementSalaryToOwner) * ownerShare;
      const personalDeclared = t1.line10100Employment + t1.line13500SelfEmployment;
      const diff = ownerDraw - personalDeclared;
      if (ownerDraw > TOL_DOLLARS && Math.abs(diff) > TOL_DOLLARS) {
        const pct = ownerDraw > 0 ? diff / ownerDraw : 0;
        const sev = severityFromVariance(pct);
        if (sev) {
          flags.push({
            code: "FORENSIC-T2-T1-OWNER-DRAW-VARIANCE",
            label: "Corporate owner-draw ≠ personal T1 declaration",
            severity: sev,
            detail: `T2 paid ${fmt(ownerDraw)} (salary + dividends @ ${t2.ownershipPct}%) vs T1 personal income ${fmt(personalDeclared)} (Δ ${fmt(diff)}).`,
            penaltyPoints: penaltyFor(sev),
            affectedDocs: ["T1", "T2"],
          });
        }
      }
    }
  }

  // T1 declares self-employment but no T2 OR T2125 backing — incorporated BFS missing the corporate return.
  if (
    t1 &&
    declaredSelfEmployment > TOL_DOLLARS &&
    t2125s.length === 0 &&
    t2s.length === 0 &&
    reconstructedSelfEmployment < TOL_DOLLARS
  ) {
    // Note: the DOC-MISSING-T2125 flag above already covered the unincorporated case.
    // Suppress duplicate when both branches would fire — handled by the existing guard.
  }

  const penaltyTotal = flags.reduce((sum, f) => sum + f.penaltyPoints, 0);


  return {
    taxYear: t1?.taxYear ?? slips[0]?.taxYear ?? null,
    declaredEmployment,
    reconstructedEmployment,
    declaredSelfEmployment,
    reconstructedSelfEmployment,
    declaredTotalIncome,
    reconstructedTotalIncome,
    variancePct,
    flags,
    penaltyTotal,
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

export function parseTaxSlip(raw: unknown): TaxSlip {
  return taxSlipSchema.parse(raw);
}
