/**
 * Unified compliance alerts hook.
 *
 * Aggregates alerts from:
 *  - Document verification store (fields needing review)
 *  - Compliance verdict (document registry engine)
 *  - Tax slip forensic checks (CRA arrears, YoY drop)
 *  - Derived financials (GDS/TDS/LTV breaches)
 *  - Loan/employment completeness
 *
 * Three-tier severity system:
 *  - CRITICAL: hard-blocks dossier generation unless overridden.
 *  - HIGH: soft warning, prompts confirmation modal before dossier.
 *  - WARN: advisory, no block.
 *
 * Alert codes auto-elevated to CRITICAL:
 *   CRA-ARREARS, FORENSIC-AML-INJECTION, FINTRAC-LCT, STRESS-FAIL,
 *   AML-IDV-INCOMPLETE, NO-VERIFIED-MANDATORY, CRITICAL_CROWN_CHARGE
 */
import { useMemo } from "react";
import { useVerificationStore, docHasReviewRequired } from "@/store/verificationStore";
import { useApplicationStore, useDerivedFinancials } from "@/store/applicationStore";
import { useTaxComplianceAlerts, useTaxSlipStore, type TaxComplianceAlert } from "@/store/taxSlipStore";
import { useAmlStore, computeAmlAlerts } from "@/store/amlStore";
import { useFundsStore, computeFundsAlerts } from "@/store/fundsStore";
import type { ComplianceVerdict } from "@/utils/documentRegistry";

export type AlertSeverity = "CRITICAL" | "HIGH" | "WARN";

export interface UnifiedAlert {
  code: string;
  label: string;
  detail: string;
  severity: AlertSeverity;
  jumpTo?: string;
  /** True when this alert type accepts a broker override note. */
  overridable: boolean;
  /** Populated when the alert has an active override. */
  overridden?: { note: string; at: string };
  /** True if unresolved: blocks (CRITICAL) or warns (HIGH) dossier. */
  blocking: boolean;
  /** Underlying tax alert reference (for legacy override modal wiring). */
  taxAlert?: TaxComplianceAlert;
}

const CRITICAL_CODES = new Set([
  "FORENSIC-AML-INJECTION",
  "FINTRAC-LCT",
  "STRESS-FAIL",
  "AML-IDV-INCOMPLETE",
  "NO-VERIFIED-MANDATORY",
  "CRITICAL_CROWN_CHARGE",
]);

function isCriticalCode(code: string): boolean {
  if (CRITICAL_CODES.has(code)) return true;
  if (code.startsWith("CRA-ARREARS")) return true;
  return false;
}

export function useComplianceAlerts({
  verdict,
  employmentComplete,
  applicantId,
}: {
  verdict: ComplianceVerdict | null;
  employmentComplete: boolean;
  applicantId?: string | null;
}): UnifiedAlert[] {
  const docs = useVerificationStore((s) => s.docs);
  const loan = useApplicationStore((s) => s.loan);
  const derived = useDerivedFinancials();
  const taxAlerts = useTaxComplianceAlerts(applicantId ?? null);
  const overrides = useTaxSlipStore((s) => s.overrides);
  const aml = useAmlStore();
  const funds = useFundsStore();

  return useMemo<UnifiedAlert[]>(() => {
    const out: UnifiedAlert[] = [];

    // Document field review flags
    for (const d of docs.filter(docHasReviewRequired)) {
      if (d.status === "verified") continue;
      out.push({
        code: `DOC-${d.kind}`,
        label: `${d.label} — Fields need review`,
        detail: `${d.fields.filter((f) => f.confidence < 95).length} low-confidence field(s).`,
        severity: "WARN",
        jumpTo: "compliance-intake",
        overridable: false,
        blocking: false,
      });
    }

    // No mandatory documents in verified status → CRITICAL
    const mandatory = docs.filter((d) => d.mandatory);
    const verifiedMandatory = mandatory.filter((d) => d.status === "verified");
    if (mandatory.length === 0 || verifiedMandatory.length === 0) {
      const code = "NO-VERIFIED-MANDATORY";
      const ov = overrides[code];
      out.push({
        code,
        label: "No verified mandatory documents",
        detail:
          mandatory.length === 0
            ? "No mandatory documents uploaded. Add and verify at least one mandatory document."
            : `${mandatory.length} mandatory document(s) uploaded but none in Verified status.`,
        severity: "CRITICAL",
        jumpTo: "compliance-intake",
        overridable: true,
        overridden: ov ? { note: ov.note, at: ov.at } : undefined,
        blocking: !ov,
      });
    }

    // Verdict alerts (document registry engine)
    if (verdict) {
      for (const a of verdict.alerts.slice(0, 12)) {
        const sev: AlertSeverity =
          a.severity === "CRITICAL" || isCriticalCode(a.code)
            ? "CRITICAL"
            : a.severity === "HIGH"
              ? "HIGH"
              : "WARN";
        const ov = overrides[a.code];
        out.push({
          code: a.code,
          label: a.label,
          detail: ov ? `${a.detail} · OVERRIDE: "${ov.note}"` : a.detail,
          severity: sev,
          jumpTo: "compliance-intake",
          overridable: sev !== "WARN",
          overridden: ov ? { note: ov.note, at: ov.at } : undefined,
          blocking: sev === "CRITICAL" ? !ov : sev === "HIGH" ? !ov : false,
        });
      }
    }

    // Tax slip forensic flags
    for (const t of taxAlerts) {
      out.push({
        code: t.code,
        label: t.label,
        detail: t.overridden ? `${t.message} · OVERRIDE: "${t.overridden.note}"` : t.message,
        severity: t.severity,
        jumpTo: t.jumpAnchor,
        overridable: t.overridable,
        overridden: t.overridden ? { note: t.overridden.note, at: t.overridden.at } : undefined,
        blocking: t.blocking,
        taxAlert: t,
      });
    }

    if (!employmentComplete) {
      out.push({
        code: "EMPL-INCOMPLETE",
        label: "Employment registry incomplete",
        detail: "Household income or amortization is missing. Complete loan terms panel.",
        severity: "HIGH",
        jumpTo: "loan-terms",
        overridable: false,
        blocking: true,
      });
    }
    if (derived.ds.gdsExceeded) {
      out.push({
        code: "GDS-BREACH",
        label: "GDS exceeds 39%",
        detail: `Current GDS ${derived.ds.gds.toFixed(1)}%. Reduce housing costs or add income.`,
        severity: "HIGH",
        jumpTo: "loan-terms",
        overridable: true,
        overridden: overrides["GDS-BREACH"]
          ? { note: overrides["GDS-BREACH"].note, at: overrides["GDS-BREACH"].at }
          : undefined,
        blocking: !overrides["GDS-BREACH"],
      });
    }
    if (derived.ds.tdsExceeded) {
      out.push({
        code: "TDS-BREACH",
        label: "TDS exceeds 44%",
        detail: `Current TDS ${derived.ds.tds.toFixed(1)}%. Address debt load.`,
        severity: "HIGH",
        jumpTo: "loan-terms",
        overridable: true,
        overridden: overrides["TDS-BREACH"]
          ? { note: overrides["TDS-BREACH"].note, at: overrides["TDS-BREACH"].at }
          : undefined,
        blocking: !overrides["TDS-BREACH"],
      });
    }
    if (derived.ltv > 80) {
      out.push({
        code: "LTV-HIGH",
        label: "LTV exceeds 80%",
        detail: `LTV ${derived.ltv.toFixed(1)}%. Insured mortgage required.`,
        severity: "WARN",
        jumpTo: "loan-terms",
        overridable: false,
        blocking: false,
      });
    }
    if (loan.propertyPrice === 0) {
      out.push({
        code: "MISSING-PRICE",
        label: "Property price missing",
        detail: "Enter property price to compute LTV.",
        severity: "WARN",
        jumpTo: "loan-terms",
        overridable: false,
        blocking: false,
      });
    }

    // Sort: CRITICAL first, then HIGH, then WARN
    const rank = { CRITICAL: 0, HIGH: 1, WARN: 2 } as const;
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [docs, verdict, employmentComplete, derived, loan.propertyPrice, taxAlerts, overrides]);
}

export interface GateStatus {
  ready: boolean;
  hasCritical: boolean;
  hasHigh: boolean;
  criticalCount: number;
  highCount: number;
  warnCount: number;
  criticalReasons: string[];
  highReasons: string[];
}

export function computeGateStatus(
  alerts: UnifiedAlert[],
  extraBlockers: string[] = [],
): GateStatus {
  const criticalUnresolved = alerts.filter((a) => a.severity === "CRITICAL" && a.blocking);
  const highUnresolved = alerts.filter((a) => a.severity === "HIGH" && a.blocking);
  const warn = alerts.filter((a) => a.severity === "WARN");
  return {
    ready: criticalUnresolved.length === 0 && extraBlockers.length === 0,
    hasCritical: criticalUnresolved.length > 0 || extraBlockers.length > 0,
    hasHigh: highUnresolved.length > 0,
    criticalCount: criticalUnresolved.length + extraBlockers.length,
    highCount: highUnresolved.length,
    warnCount: warn.length,
    criticalReasons: [...criticalUnresolved.map((a) => a.label), ...extraBlockers],
    highReasons: highUnresolved.map((a) => a.label),
  };
}
