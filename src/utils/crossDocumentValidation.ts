/**
 * Cross-Document Validation — Phase 1.7.
 *
 * Reconciles canonical extracted data ACROSS multiple documents for the same
 * applicant, after each document's own DocumentRegistry `validate()` has
 * already run. This is a deliberately separate concern from single-document
 * validation:
 *
 *   - Individual DocumentRegistry entries (src/utils/documentRegistry.ts)
 *     validate only their OWN extracted fields and never know another
 *     document exists. That stays true after this file exists — nothing
 *     here is embedded into any DocumentRegistry entry's `validate()`.
 *   - This module operates purely on `{ kind, extracted }` pairs — the same
 *     plain shape `ProcessedDocument` already carries. It has no dependency
 *     on OCR/AI providers, the ingestion pipeline, or Supabase — a rule here
 *     could run identically against live extraction results, replayed
 *     telemetry, or a unit test fixture.
 *   - It imports only TYPES from documentRegistry.ts (DocumentKind,
 *     ComplianceAlert, ComplianceSeverity, ExtractedFields) — never
 *     `processDocument`/`aggregateCompliance`/`runSuperPriorityChecks`, and
 *     never verificationStore.ts, DocumentVerificationModal.tsx, or
 *     DossierGate.tsx. The protected verification engine is read from, via
 *     its already-public state, by the caller (see
 *     src/hooks/useComplianceAlerts.ts) — not by this file.
 *
 * New rules are added by appending to CROSS_DOCUMENT_RULES (or, for a
 * same-fact-across-documents check, to a FACT_GROUPS entry) — never by
 * editing an existing DocumentRegistry entry.
 *
 * Scope note: this intentionally does NOT implement every example in the
 * Phase 1.7 brief. Two are flagged as gaps rather than faked:
 *   - Down-payment shortfall requires the loan amount / purchase price from
 *     applicationStore, which lives outside the document set this module
 *     operates on — a document-only rule can't compute it honestly.
 *   - "HELOC statement missing for reported HELOC" would need per-tradeline
 *     itemization on CREDIT_BUREAU_REPORT (product-type-tagged balances),
 *     which the current flat ExtractedFields shape doesn't carry; only an
 *     aggregate `mortgageBalanceReported` proxy exists today (see that
 *     field's `hint` in documentRegistry.ts).
 */
import type {
  ComplianceAlert,
  ComplianceSeverity,
  DocumentKind,
  ExtractedFields,
} from "./documentRegistry";

export interface CrossDocDoc {
  kind: DocumentKind;
  extracted: ExtractedFields;
}

export type CrossDocRuleCategory =
  | "Income"
  | "Liabilities"
  | "Property"
  | "Assets"
  | "Rental"
  | "Identity"
  | "Corporate";

export interface CrossDocRule {
  id: string;
  category: CrossDocRuleCategory;
  description: string;
  evaluate: (byKind: Map<DocumentKind, CrossDocDoc[]>, all: CrossDocDoc[]) => ComplianceAlert[];
}

// ────────────────────────────────────────────────────────────────────────────────
// Local helpers (kept separate from documentRegistry.ts's private helpers —
// this module has zero import dependency on that file's internals, only its
// exported types).
// ────────────────────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

const fmt = (n: number): string =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);

function byKindMap(docs: CrossDocDoc[]): Map<DocumentKind, CrossDocDoc[]> {
  const m = new Map<DocumentKind, CrossDocDoc[]>();
  for (const d of docs) {
    const arr = m.get(d.kind);
    if (arr) arr.push(d);
    else m.set(d.kind, [d]);
  }
  return m;
}

function normalizeText(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if the shorter value's words mostly appear in the longer one — tolerant of
 *  middle names/initials/formatting differences, but still catches real mismatches. */
function namesRoughlyMatch(a: string, b: string): boolean {
  const ta = normalizeText(a).split(" ").filter(Boolean);
  const tb = normalizeText(b).split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return true;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const longerSet = new Set(longer);
  const hits = shorter.filter((t) => longerSet.has(t)).length;
  return hits / shorter.length >= 0.5;
}

const PAY_FREQUENCY_PERIODS_PER_YEAR: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  "semi-monthly": 24,
  semimonthly: 24,
  monthly: 12,
};

function annualizePay(grossPay: number, payFrequency: string): number | null {
  const key = payFrequency.toLowerCase().trim();
  const periods = PAY_FREQUENCY_PERIODS_PER_YEAR[key];
  if (!periods) return null;
  return grossPay * periods;
}

// ────────────────────────────────────────────────────────────────────────────────
// Fact groups — "this value should represent the same real-world fact across
// every document that reports it." Generates one rule per group; a new
// document kind joins a fact group by adding a {kind, field} pair, never by
// touching another kind's DocumentRegistry entry.
// ────────────────────────────────────────────────────────────────────────────────

interface FactGroupMember {
  kind: DocumentKind;
  field: string;
}

interface FactGroupSpec {
  id: string;
  category: CrossDocRuleCategory;
  label: string;
  members: FactGroupMember[];
  severity: ComplianceSeverity;
  penaltyPoints: number;
}

const FACT_GROUPS: FactGroupSpec[] = [
  {
    id: "IDENTITY-NAME",
    category: "Identity",
    label: "borrower name",
    severity: "WARNING",
    penaltyPoints: 10,
    members: [
      { kind: "GOVT_ID", field: "fullName" },
      { kind: "T1", field: "taxpayerName" },
      { kind: "NOA", field: "taxpayerName" },
      { kind: "LETTER_OF_EMPLOYMENT", field: "employeeName" },
      { kind: "PAY_STUB", field: "employeeName" },
      { kind: "PERSONAL_BANK_STATEMENT", field: "accountHolderName" },
      { kind: "GIFT_LETTER", field: "recipientName" },
    ],
  },
  {
    id: "PROPERTY-ADDRESS",
    category: "Property",
    label: "subject property address",
    severity: "WARNING",
    penaltyPoints: 10,
    members: [
      { kind: "AGREEMENT_OF_PURCHASE_SALE", field: "propertyAddress" },
      { kind: "APPRAISAL_REPORT", field: "propertyAddress" },
      { kind: "PROPERTY_TAX_STATEMENT", field: "propertyAddress" },
      { kind: "HOME_INSURANCE_BINDER", field: "propertyAddress" },
      { kind: "TITLE_INSURANCE", field: "propertyAddress" },
      { kind: "PROPERTY_DEED", field: "propertyAddress" },
      { kind: "SURVEY_PLAN", field: "propertyAddress" },
      { kind: "MLS_LISTING", field: "propertyAddress" },
    ],
  },
  {
    id: "CORPORATE-NAME",
    category: "Corporate",
    label: "corporate/business name",
    severity: "WARNING",
    penaltyPoints: 10,
    members: [
      { kind: "ARTICLES_OF_INCORPORATION", field: "corporationName" },
      { kind: "CORP_PROFILE_REPORT", field: "corporationName" },
      { kind: "CORP_FINANCIAL_STATEMENTS", field: "corporationName" },
      { kind: "T2", field: "corporationName" },
      { kind: "BUSINESS_BANK_STATEMENT", field: "businessName" },
      { kind: "BUSINESS_LICENCE", field: "businessName" },
    ],
  },
];

function evaluateFactGroup(spec: FactGroupSpec, byKind: Map<DocumentKind, CrossDocDoc[]>): ComplianceAlert[] {
  const observations: { kind: DocumentKind; value: string }[] = [];
  for (const member of spec.members) {
    const docs = byKind.get(member.kind);
    if (!docs) continue;
    for (const d of docs) {
      const value = str(d.extracted[member.field]);
      if (value) observations.push({ kind: member.kind, value });
    }
  }
  if (observations.length < 2) return [];

  const base = observations[0];
  const conflicting = observations.filter((o) => !namesRoughlyMatch(base.value, o.value));
  if (conflicting.length === 0) return [];

  const distinctValues = Array.from(new Set(observations.map((o) => o.value)));
  return [{
    code: `XDOC-${spec.id}-MISMATCH`,
    label: `${spec.label[0].toUpperCase()}${spec.label.slice(1)} mismatch across documents`,
    severity: spec.severity,
    detail: `Documents disagree on ${spec.label}: ${distinctValues.map((v) => `"${v}"`).join(" vs. ")} (${observations.map((o) => o.kind).join(", ")}).`,
    sourceDoc: base.kind,
    penaltyPoints: spec.penaltyPoints,
  }];
}

// ────────────────────────────────────────────────────────────────────────────────
// Hand-written rules — numeric/business reconciliation that a generic
// fact-group check can't express.
// ────────────────────────────────────────────────────────────────────────────────

const CROSS_DOCUMENT_RULES: CrossDocRule[] = [
  // ── Income ──
  {
    id: "INCOME-LOE-VS-ANNUALIZED-PAYSTUB",
    category: "Income",
    description: "Letter of Employment annual salary vs. annualized Pay Stub gross pay.",
    evaluate: (byKind) => {
      const loes = byKind.get("LETTER_OF_EMPLOYMENT") ?? [];
      const stubs = byKind.get("PAY_STUB") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const loe of loes) {
        const salary = num(loe.extracted.annualSalary);
        if (salary <= 0) continue;
        for (const stub of stubs) {
          if (!namesRoughlyMatch(str(loe.extracted.employeeName), str(stub.extracted.employeeName))) continue;
          const annualized = annualizePay(num(stub.extracted.grossPay), str(stub.extracted.payFrequency));
          if (annualized == null) continue;
          const diff = Math.abs(salary - annualized);
          if (diff > 500 && diff / salary > 0.1) {
            alerts.push({
              code: "XDOC-INCOME-LOE-PAYSTUB-VARIANCE",
              label: "Letter of Employment salary ≠ annualized Pay Stub",
              severity: "WARNING",
              detail: `LOE declares ${fmt(salary)}/yr; Pay Stub annualizes to ${fmt(annualized)}/yr (Δ ${fmt(diff)}).`,
              sourceDoc: "LETTER_OF_EMPLOYMENT",
              penaltyPoints: 10,
            });
          }
        }
      }
      return alerts;
    },
  },
  {
    id: "INCOME-LOE-VS-T4",
    category: "Income",
    description: "Letter of Employment annual salary vs. prior-year T4 employment income (Box 14).",
    evaluate: (byKind) => {
      const loes = byKind.get("LETTER_OF_EMPLOYMENT") ?? [];
      const t4s = byKind.get("T4") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const loe of loes) {
        const salary = num(loe.extracted.annualSalary);
        if (salary <= 0) continue;
        for (const t4 of t4s) {
          if (!namesRoughlyMatch(str(loe.extracted.employeeName), str(t4.extracted.payerName))) {
            // payerName on T4 is the employer, not the employee — only compare
            // when an employer-name match confirms it's the same job.
            if (!namesRoughlyMatch(str(loe.extracted.employerName), str(t4.extracted.payerName))) continue;
          }
          const box14 = num(t4.extracted.box_14);
          if (box14 <= 0) continue;
          const diff = Math.abs(salary - box14);
          if (diff / box14 > 0.3) {
            alerts.push({
              code: "XDOC-INCOME-LOE-T4-VARIANCE",
              label: "Letter of Employment salary differs materially from T4 employment income",
              severity: "WARNING",
              detail: `LOE declares ${fmt(salary)}/yr; prior-year T4 Box 14 = ${fmt(box14)} (Δ ${((diff / box14) * 100).toFixed(0)}%). Tax-year timing may explain part of this — confirm.`,
              sourceDoc: "LETTER_OF_EMPLOYMENT",
              penaltyPoints: 5,
            });
          }
        }
      }
      return alerts;
    },
  },
  {
    id: "INCOME-T1-VS-NOA",
    category: "Income",
    description: "T1 line 15000 total income vs. NOA line 15000 total income, same tax year.",
    evaluate: (byKind) => {
      const t1s = byKind.get("T1") ?? [];
      const noas = byKind.get("NOA") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const t1 of t1s) {
        for (const noa of noas) {
          const t1Year = num(t1.extracted.taxYear);
          const noaYear = num(noa.extracted.taxYear);
          if (t1Year && noaYear && t1Year !== noaYear) continue; // different year, not a variance
          const t1Income = num(t1.extracted.line_15000_total_income);
          const noaIncome = num(noa.extracted.line_15000_total_income);
          if (t1Income <= 0 || noaIncome <= 0) continue;
          const diff = Math.abs(t1Income - noaIncome);
          if (diff > 50) {
            alerts.push({
              code: "XDOC-T1-NOA-INCOME-VARIANCE",
              label: "T1 total income ≠ NOA total income",
              severity: diff / Math.max(t1Income, noaIncome) > 0.1 ? "HIGH" : "WARNING",
              detail: `T1 line 15000 = ${fmt(t1Income)}; NOA line 15000 = ${fmt(noaIncome)} (Δ ${fmt(diff)}). Possible reassessment or filing error.`,
              sourceDoc: "T1",
              penaltyPoints: 15,
            });
          }
        }
      }
      return alerts;
    },
  },
  {
    id: "INCOME-EMPLOYMENT-CONTRACT-VS-LOE",
    category: "Income",
    description: "Employment Contract base salary vs. Letter of Employment annual salary.",
    evaluate: (byKind) => {
      const contracts = byKind.get("EMPLOYMENT_CONTRACT") ?? [];
      const loes = byKind.get("LETTER_OF_EMPLOYMENT") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const c of contracts) {
        const base = num(c.extracted.baseSalary);
        if (base <= 0) continue;
        for (const loe of loes) {
          if (!namesRoughlyMatch(str(c.extracted.employeeName), str(loe.extracted.employeeName))) continue;
          const salary = num(loe.extracted.annualSalary);
          if (salary <= 0) continue;
          const diff = Math.abs(base - salary);
          if (diff > 500 && diff / salary > 0.1) {
            alerts.push({
              code: "XDOC-CONTRACT-LOE-SALARY-VARIANCE",
              label: "Employment Contract salary ≠ Letter of Employment salary",
              severity: "WARNING",
              detail: `Contract base salary ${fmt(base)}; LOE states ${fmt(salary)} (Δ ${fmt(diff)}).`,
              sourceDoc: "EMPLOYMENT_CONTRACT",
              penaltyPoints: 10,
            });
          }
        }
      }
      return alerts;
    },
  },

  // ── Liabilities ──
  {
    id: "LIAB-BUREAU-VS-MORTGAGE-STATEMENT",
    category: "Liabilities",
    description: "Credit bureau reported mortgage balance vs. uploaded Mortgage Statement balance.",
    evaluate: (byKind) => {
      const bureaus = byKind.get("CREDIT_BUREAU_REPORT") ?? [];
      const mortgages = byKind.get("MORTGAGE_STATEMENT") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const b of bureaus) {
        const bureauBalance = num(b.extracted.mortgageBalanceReported);
        if (bureauBalance <= 0) continue;
        if (mortgages.length === 0) {
          alerts.push({
            code: "XDOC-BUREAU-MORTGAGE-UNSUPPORTED",
            label: "Bureau reports a mortgage tradeline with no supporting Mortgage Statement",
            severity: "HIGH",
            detail: `${str(b.extracted.bureau) || "Credit bureau"} report shows ${fmt(bureauBalance)} mortgage balance, but no Mortgage Statement was uploaded to confirm it.`,
            sourceDoc: "CREDIT_BUREAU_REPORT",
            penaltyPoints: 15,
          });
          continue;
        }
        for (const m of mortgages) {
          const stmtBalance = num(m.extracted.currentBalance);
          if (stmtBalance <= 0) continue;
          const diff = Math.abs(bureauBalance - stmtBalance);
          if (diff > 5000 && diff / stmtBalance > 0.1) {
            alerts.push({
              code: "XDOC-BUREAU-MORTGAGE-BALANCE-VARIANCE",
              label: "Credit bureau mortgage balance ≠ Mortgage Statement balance",
              severity: "WARNING",
              detail: `Bureau reports ${fmt(bureauBalance)}; Mortgage Statement shows ${fmt(stmtBalance)} (Δ ${fmt(diff)}).`,
              sourceDoc: "CREDIT_BUREAU_REPORT",
              penaltyPoints: 10,
            });
          }
        }
      }
      return alerts;
    },
  },

  // ── Property ──
  {
    id: "PROPERTY-APS-VS-APPRAISAL",
    category: "Property",
    description: "Agreement of Purchase and Sale price vs. Appraisal Report value.",
    evaluate: (byKind) => {
      const apss = byKind.get("AGREEMENT_OF_PURCHASE_SALE") ?? [];
      const appraisals = byKind.get("APPRAISAL_REPORT") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const aps of apss) {
        const price = num(aps.extracted.purchasePrice);
        if (price <= 0) continue;
        for (const appraisal of appraisals) {
          const value = num(appraisal.extracted.appraisedValue);
          if (value <= 0) continue;
          if (value < price) {
            const shortfall = price - value;
            alerts.push({
              code: "XDOC-APS-APPRAISAL-SHORTFALL",
              label: "Appraised value below purchase price",
              severity: shortfall / price > 0.05 ? "HIGH" : "WARNING",
              detail: `Purchase price ${fmt(price)} vs. appraised value ${fmt(value)} (shortfall ${fmt(shortfall)}). LTV is based on the lesser of the two.`,
              sourceDoc: "APPRAISAL_REPORT",
              penaltyPoints: 15,
            });
          }
        }
      }
      return alerts;
    },
  },
  {
    id: "PROPERTY-DEED-OWNERSHIP-VS-IDENTITY",
    category: "Property",
    description: "Property Deed registered owner vs. applicant identity documents.",
    evaluate: (byKind) => {
      const deeds = byKind.get("PROPERTY_DEED") ?? [];
      const ids = byKind.get("GOVT_ID") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const deed of deeds) {
        const owner = str(deed.extracted.registeredOwner);
        if (!owner) continue;
        for (const id of ids) {
          const applicant = str(id.extracted.fullName);
          if (!applicant) continue;
          if (!namesRoughlyMatch(owner, applicant)) {
            alerts.push({
              code: "XDOC-DEED-OWNERSHIP-MISMATCH",
              label: "Registered owner on deed does not match applicant identity",
              severity: "WARNING",
              detail: `Deed lists "${owner}"; applicant identity document shows "${applicant}" — confirm ownership chain (refinance under a different name, estate, trust, etc.).`,
              sourceDoc: "PROPERTY_DEED",
              penaltyPoints: 10,
            });
          }
        }
      }
      return alerts;
    },
  },

  // ── Assets ──
  {
    id: "ASSET-GIFT-VS-DEPOSIT",
    category: "Assets",
    description: "Gift Letter amount vs. matching Large Deposit Documentation.",
    evaluate: (byKind) => {
      const gifts = byKind.get("GIFT_LETTER") ?? [];
      const deposits = byKind.get("LARGE_DEPOSIT_DOCUMENTATION") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const gift of gifts) {
        const amount = num(gift.extracted.giftAmount);
        if (amount <= 0) continue;
        const matching = deposits.filter((d) => Math.abs(num(d.extracted.depositAmount) - amount) / amount <= 0.05);
        if (matching.length === 0) {
          alerts.push({
            code: "XDOC-GIFT-NO-MATCHING-DEPOSIT",
            label: "Gift letter has no matching deposit documentation",
            severity: "WARNING",
            detail: `Gift letter declares ${fmt(amount)}, but no Large Deposit Documentation on file matches that amount — confirm the gift is traceable in bank records.`,
            sourceDoc: "GIFT_LETTER",
            penaltyPoints: 10,
          });
        }
      }
      return alerts;
    },
  },

  // ── Rental ──
  {
    id: "RENTAL-LEASE-VS-T776",
    category: "Rental",
    description: "Lease Agreement annualized rent vs. T776 gross rental income.",
    evaluate: (byKind) => {
      const leases = byKind.get("LEASE_AGREEMENT") ?? [];
      const t776s = byKind.get("T776") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const lease of leases) {
        const monthlyRent = num(lease.extracted.monthlyRent);
        if (monthlyRent <= 0) continue;
        const annualizedRent = monthlyRent * 12;
        for (const t776 of t776s) {
          const gross = num(t776.extracted.grossRentalIncome);
          if (gross <= 0) continue;
          const diff = Math.abs(annualizedRent - gross);
          if (diff / gross > 0.15) {
            alerts.push({
              code: "XDOC-LEASE-T776-RENT-VARIANCE",
              label: "Lease Agreement rent ≠ T776 gross rental income",
              severity: "WARNING",
              detail: `Lease annualizes to ${fmt(annualizedRent)}/yr; T776 reports gross rental income of ${fmt(gross)} (Δ ${fmt(diff)}).`,
              sourceDoc: "LEASE_AGREEMENT",
              penaltyPoints: 10,
            });
          }
        }
      }
      return alerts;
    },
  },
  {
    id: "RENTAL-T776-MISSING-EVIDENCE",
    category: "Rental",
    description: "T776 rental income reported with no Lease Agreement or Rent Roll on file.",
    evaluate: (byKind) => {
      const t776s = byKind.get("T776") ?? [];
      const leases = byKind.get("LEASE_AGREEMENT") ?? [];
      const rentRolls = byKind.get("RENT_ROLL") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const t776 of t776s) {
        if (num(t776.extracted.grossRentalIncome) > 0 && leases.length === 0 && rentRolls.length === 0) {
          alerts.push({
            code: "XDOC-T776-NO-RENTAL-EVIDENCE",
            label: "T776 rental income declared with no supporting rental documents",
            severity: "WARNING",
            detail: "T776 reports gross rental income but no Lease Agreement or Rent Roll was uploaded to support it.",
            sourceDoc: "T776",
            penaltyPoints: 10,
          });
        }
      }
      return alerts;
    },
  },

  // ── Corporate ──
  {
    id: "CORPORATE-DIRECTORS-VS-APPLICANT",
    category: "Corporate",
    description: "Corporate Profile Report directors vs. applicant identity (approximates ownership check).",
    evaluate: (byKind) => {
      const profiles = byKind.get("CORP_PROFILE_REPORT") ?? [];
      const ids = byKind.get("GOVT_ID") ?? [];
      const alerts: ComplianceAlert[] = [];
      for (const profile of profiles) {
        const directors = str(profile.extracted.directors);
        if (!directors) continue;
        for (const id of ids) {
          const applicant = str(id.extracted.fullName);
          if (!applicant) continue;
          const directorList = directors.split(/[,;]/).map((d) => d.trim()).filter(Boolean);
          const appearsAsDirector = directorList.some((d) => namesRoughlyMatch(d, applicant));
          if (!appearsAsDirector) {
            alerts.push({
              code: "XDOC-CORP-DIRECTOR-MISMATCH",
              label: "Applicant does not appear among listed corporate directors",
              severity: "WARNING",
              detail: `Corporate profile report directors: "${directors}". Applicant "${applicant}" not found — confirm ownership/signing authority for this file.`,
              sourceDoc: "CORP_PROFILE_REPORT",
              penaltyPoints: 10,
            });
          }
        }
      }
      return alerts;
    },
  },
];

// ────────────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────────────

export function runCrossDocumentValidation(docs: CrossDocDoc[]): ComplianceAlert[] {
  const byKind = byKindMap(docs);
  const alerts: ComplianceAlert[] = [];

  for (const group of FACT_GROUPS) {
    alerts.push(...evaluateFactGroup(group, byKind));
  }
  for (const rule of CROSS_DOCUMENT_RULES) {
    alerts.push(...rule.evaluate(byKind, docs));
  }

  // De-dupe by code, same convention as documentRegistry.ts's processDocument().
  const seen = new Set<string>();
  return alerts.filter((a) => {
    if (seen.has(a.code)) return false;
    seen.add(a.code);
    return true;
  });
}

/** Exposed for tooling/tests that want the raw rule list (e.g. a future
 *  Internal Tools rule inspector) without re-deriving it from FACT_GROUPS. */
export function listCrossDocumentRuleDescriptions(): { id: string; category: CrossDocRuleCategory; description: string }[] {
  const fromGroups = FACT_GROUPS.map((g) => ({
    id: `${g.id}-MISMATCH`,
    category: g.category,
    description: `Flags a mismatched ${g.label} across: ${g.members.map((m) => m.kind).join(", ")}.`,
  }));
  const fromRules = CROSS_DOCUMENT_RULES.map((r) => ({ id: r.id, category: r.category, description: r.description }));
  return [...fromGroups, ...fromRules];
}
