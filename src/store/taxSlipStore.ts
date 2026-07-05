/**
 * Tax Slip forensic store — publishes T1 snapshots per applicant so the
 * global Compliance Health Sidebar / Dossier Gate can react without
 * re-implementing tax-slip UI state.
 *
 * Adds two forensic checks:
 *   • CRA-ARREARS      — HIGH  flag when Line 26000 balance owing > 0.
 *   • INC-DROP-YOY     — WARN  flag when Line 15000 drops > 15% YoY.
 *
 * Also stores broker overrides (mandatory note) that unblock the dossier
 * gate and are mirrored to compliance_alerts as an immutable audit trail.
 */
import { create } from "zustand";
import type { T1 } from "@/utils/taxSlipParser";

export interface ComplianceOverride {
  code: string;
  note: string;
  at: string;
}

export interface TaxComplianceAlert {
  code: string;
  severity: "CRITICAL" | "HIGH" | "WARN";
  label: string;
  message: string;
  taxYear: number;
  jumpAnchor: string;
  overridable: boolean;
  overridden?: ComplianceOverride;
  /** blocks dossier generation until resolved or overridden */
  blocking: boolean;
  amount?: number;
}


interface State {
  t1sByApplicant: Record<string, T1[]>;
  overrides: Record<string, ComplianceOverride>;
  setT1s: (applicantId: string, t1s: T1[]) => void;
  setOverride: (code: string, note: string) => void;
  clearOverride: (code: string) => void;
}

export const useTaxSlipStore = create<State>((set) => ({
  t1sByApplicant: {},
  overrides: {},
  setT1s: (applicantId, t1s) =>
    set((s) => ({ t1sByApplicant: { ...s.t1sByApplicant, [applicantId]: t1s } })),
  setOverride: (code, note) =>
    set((s) => ({
      overrides: {
        ...s.overrides,
        [code]: { code, note, at: new Date().toISOString() },
      },
    })),
  clearOverride: (code) =>
    set((s) => {
      const next = { ...s.overrides };
      delete next[code];
      return { overrides: next };
    }),
}));

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function computeTaxComplianceAlerts(
  t1s: T1[],
  overrides: Record<string, ComplianceOverride>,
): TaxComplianceAlert[] {
  const out: TaxComplianceAlert[] = [];

  // 1) CRA arrears per year
  for (const t1 of t1s) {
    const bal = Number(t1.balanceOwing ?? 0);
    if (bal > 0) {
      const code = `CRA-ARREARS:${t1.taxYear}`;
      const ov = overrides[code];
      out.push({
        code,
        severity: "CRITICAL",
        label: `CRA arrears — ${t1.taxYear}`,
        message: `CRA balance owing of ${money(bal)} detected on ${t1.taxYear} T1. Lender will require proof of payment or CRA payment arrangement prior to instruction.`,
        taxYear: t1.taxYear,
        jumpAnchor: `t1-balance-${t1.taxYear}`,
        overridable: true,
        overridden: ov,
        blocking: !ov,
        amount: bal,
      });
    }
  }

  // 2) YoY total income drop > 15%
  const sorted = [...t1s]
    .filter((t) => t.line15000TotalIncome > 0)
    .sort((a, b) => a.taxYear - b.taxYear);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.line15000TotalIncome <= 0) continue;
    const dropPct =
      ((prev.line15000TotalIncome - cur.line15000TotalIncome) /
        prev.line15000TotalIncome) *
      100;
    if (dropPct > 15) {
      out.push({
        code: `INC-DROP-YOY:${prev.taxYear}-${cur.taxYear}`,
        severity: "WARN",
        label: `Income drop ${prev.taxYear}→${cur.taxYear}`,
        message: `Year-over-year income variance of ${dropPct.toFixed(1)}% detected between ${prev.taxYear} and ${cur.taxYear}. Lender may request written explanation.`,
        taxYear: cur.taxYear,
        jumpAnchor: `t1-line15000-${cur.taxYear}`,
        overridable: false,
        blocking: false,
      });
    }
  }

  return out;
}

export function useTaxComplianceAlerts(applicantId: string | null | undefined): TaxComplianceAlert[] {
  const t1s = useTaxSlipStore((s) => (applicantId ? s.t1sByApplicant[applicantId] : undefined));
  const overrides = useTaxSlipStore((s) => s.overrides);
  if (!t1s || t1s.length === 0) return [];
  return computeTaxComplianceAlerts(t1s, overrides);
}
