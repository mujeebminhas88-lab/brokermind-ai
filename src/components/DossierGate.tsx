import { useMemo, useState } from "react";
import { FileCheck2, Lock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { useVerificationStore } from "@/store/verificationStore";
import { useDerivedFinancials, useApplicationStore } from "@/store/applicationStore";
import { useConditionsStore } from "@/store/conditionsStore";
import { useCreditProfileStore, beaconTier } from "@/store/creditProfileStore";
import { usePropertyStore } from "@/store/propertyStore";
import { useBrokerSettingsStore } from "@/store/brokerSettingsStore";
import type { ComplianceVerdict } from "@/utils/documentRegistry";
import { useComplianceAlerts, computeGateStatus } from "@/hooks/useComplianceAlerts";

interface Props {
  applicantName?: string | null;
  applicationNumber?: string | null;
  applicantId?: string | null;
  verdict: ComplianceVerdict | null;
  employmentComplete: boolean;
  employmentType?: string | null;
}

const CYAN = "#00BCD4";
const MAGENTA = "#E91E8C";
const PURPLE = "#9C27B0";

interface Check {
  id: string;
  label: string;
  done: boolean;
  jumpTo: string;
}

function jumpToAnchor(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = el.querySelector<HTMLInputElement>("input, select, textarea");
  input?.focus();
  el.classList.add("ring-2", "ring-[hsl(var(--brand-magenta,328_82%_51%))]");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-[hsl(var(--brand-magenta,328_82%_51%))]");
  }, 1800);
}

export function DossierGate({
  applicantName,
  applicationNumber,
  applicantId,
  verdict,
  employmentComplete,
  employmentType,
}: Props) {
  const docs = useVerificationStore((s) => s.docs);
  const derived = useDerivedFinancials();
  const loan = useApplicationStore((s) => s.loan);
  const conditions = useConditionsStore((s) => s.conditions);
  const credit = useCreditProfileStore();
  const property = usePropertyStore();
  const broker = useBrokerSettingsStore();
  const alerts = useComplianceAlerts({ verdict, employmentComplete, applicantId });
  const [highWarningOpen, setHighWarningOpen] = useState(false);


  const gate = useMemo(() => {
    const extra: string[] = [];
    if (!applicantName) extra.push("Applicant name required");
    return computeGateStatus(alerts, extra);
  }, [alerts, applicantName]);

  const checks = useMemo<Check[]>(() => {
    const unresolvedCritical = alerts.filter((a) => a.severity === "CRITICAL" && a.blocking);
    const unresolvedAml = alerts.some(
      (a) => a.blocking && /AML|IDV|FINTRAC/i.test(a.code),
    );
    const unresolvedCra = alerts.filter(
      (a) => a.blocking && a.code.startsWith("CRA-ARREARS"),
    );
    const craAnchor = unresolvedCra[0]?.jumpTo ?? "compliance-intake";

    return [
      {
        id: "mandatory-doc",
        label: "At least one mandatory document uploaded and Verified",
        done: docs.some((d) => d.mandatory && d.status === "verified"),
        jumpTo: "compliance-intake",
      },
      {
        id: "employment-type",
        label: "Employment type selected (Salaried / Self-Employed / Incorporated)",
        done: !!employmentType,
        jumpTo: "compliance-intake",
      },
      {
        id: "loan-terms",
        label: "Loan Terms complete (property price, down payment, contract rate)",
        done: loan.propertyPrice > 0 && loan.downPayment > 0 && loan.interestRatePct > 0,
        jumpTo: "loan-terms",
      },
      {
        id: "primary-income",
        label: "Primary annual income entered",
        done: loan.primaryAnnualIncome > 0,
        jumpTo: "loan-terms",
      },
      {
        id: "critical-clear",
        label: "All CRITICAL compliance flags resolved or overridden",
        done: unresolvedCritical.length === 0,
        jumpTo: unresolvedCritical[0]?.jumpTo ?? "compliance-intake",
      },
      {
        id: "stress-test",
        label: "Stress test calculated (contract rate entered)",
        done: loan.interestRatePct > 0,
        jumpTo: "loan-terms",
      },
      {
        id: "aml-idv",
        label: "Applicant identity verification complete (AML)",
        done: !unresolvedAml,
        jumpTo: "compliance-intake",
      },
      {
        id: "cra-arrears",
        label: "CRA Balance Owing resolved or overridden",
        done: unresolvedCra.length === 0,
        jumpTo: craAnchor,
      },
    ];
  }, [alerts, docs, employmentType, loan]);

  const completedCount = checks.filter((c) => c.done).length;
  const totalCount = checks.length;
  const allComplete = completedCount === totalCount;
  const progressPct = (completedCount / totalCount) * 100;



  const generate = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    let y = 40;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 70, "F");
    doc.setFillColor(CYAN);
    doc.rect(0, 70, W, 4, "F");
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("BrokerMindAI", 40, 35);
    doc.setFontSize(10);
    doc.setTextColor(CYAN);
    doc.text("Credit Qualification Dossier", 40, 55);
    y = 100;

    doc.setTextColor("#0f172a");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(applicantName ?? "Unnamed Applicant", 40, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor("#475569");
    doc.text(`Application: ${applicationNumber ?? "—"}`, 40, y + 16);
    doc.text(`Generated: ${new Date().toLocaleString("en-CA")}`, 40, y + 30);
    y += 60;

    const section = (title: string, color: string) => {
      doc.setFillColor(color);
      doc.rect(40, y, W - 80, 20, "F");
      doc.setTextColor("#ffffff");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title.toUpperCase(), 48, y + 14);
      y += 30;
      doc.setTextColor("#0f172a");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    };

    const row = (l: string, v: string) => {
      doc.setTextColor("#64748b");
      doc.text(l, 48, y);
      doc.setTextColor("#0f172a");
      doc.setFont("helvetica", "bold");
      doc.text(v, W - 48, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 14;
    };

    section("Financial Ratios", CYAN);
    row("Loan-to-Value (LTV)", `${derived.ltv.toFixed(2)}%`);
    row("Gross Debt Service (GDS)", `${derived.ds.gds.toFixed(2)}%`);
    row("Total Debt Service (TDS)", `${derived.ds.tds.toFixed(2)}%`);
    row(
      "Monthly Principal + Interest",
      derived.monthlyPI.toLocaleString("en-CA", { style: "currency", currency: "CAD" }),
    );
    row(
      "Household Income",
      derived.householdIncome.toLocaleString("en-CA", { style: "currency", currency: "CAD" }),
    );
    y += 10;

    section("Loan Summary", PURPLE);
    row(
      "Property Price",
      loan.propertyPrice.toLocaleString("en-CA", { style: "currency", currency: "CAD" }),
    );
    row(
      "Down Payment",
      loan.downPayment.toLocaleString("en-CA", { style: "currency", currency: "CAD" }),
    );
    row("Interest Rate", `${loan.interestRatePct.toFixed(2)}%`);
    row("Amortization", `${loan.amortizationYears} years`);
    y += 10;

    section("Compliance Status", MAGENTA);
    row("Highest Severity", verdict?.highestSeverity ?? "CLEAN");
    row("Total Penalty Points", String(verdict?.totalPenalty ?? 0));
    row("Critical (blocking)", String(gate.criticalCount));
    row("High (warned)", String(gate.highCount));
    row("Documents Verified", `${docs.filter((d) => d.status === "verified").length} / ${docs.length}`);
    y += 10;

    section("Scorecard", CYAN);
    const score = Math.max(
      0,
      100 -
        (verdict?.totalPenalty ?? 0) -
        (derived.ds.gdsExceeded ? 10 : 0) -
        (derived.ds.tdsExceeded ? 10 : 0) -
        (derived.ltv > 80 ? 5 : 0) -
        gate.highCount * 3,
    );
    row("Composite Adjudication Score", `${score} / 100`);
    row(
      "Verdict",
      score >= 75 ? "APPROVE" : score >= 55 ? "CONDITIONAL" : "DECLINE / MANUAL",
    );

    doc.setDrawColor(CYAN);
    doc.setLineWidth(1);
    doc.line(40, 760, W - 40, 760);
    doc.setFontSize(8);
    doc.setTextColor("#94a3b8");
    doc.text("BrokerMindAI — Confidential Credit Adjudication Dossier", 40, 774);

    doc.save(
      `Dossier_${(applicantName ?? "applicant").replace(/\s+/g, "_")}_${Date.now()}.pdf`,
    );
    toast.success("Dossier generated");
  };

  const handleClick = () => {
    if (!allComplete) return; // hard block: every checklist item must pass
    if (gate.hasHigh) {
      setHighWarningOpen(true);
      return;
    }
    generate();
  };

  const disabled = !allComplete;
  const incompleteLabels = checks.filter((c) => !c.done).map((c) => c.label);
  const tooltip = disabled
    ? `Blocked: ${incompleteLabels.length} check${incompleteLabels.length === 1 ? "" : "s"} incomplete`
    : undefined;

  return (
    <>
      <div className="rounded-sm border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--brand-cyan,187_100%_42%))]">
              Dossier Readiness Gate
            </div>
            <div className="text-sm font-semibold text-foreground">
              Generate Credit Qualification Dossier
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Progress
            </div>
            <div
              className={`text-sm font-bold ${allComplete ? "text-emerald-600" : "text-foreground"}`}
            >
              {completedCount} of {totalCount} checks complete
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-2 w-full overflow-hidden rounded-sm bg-muted">
          <div
            className={`h-full transition-all duration-300 ${
              allComplete
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-[#00BCD4] via-[#9C27B0] to-[#E91E8C]"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Checklist */}
        <ul className="mb-4 flex flex-col divide-y divide-border rounded-sm border border-border">
          {checks.map((c) => (
            <li
              key={c.id}
              className={`flex items-start gap-2.5 px-3 py-2 text-xs ${
                c.done ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-card"
              }`}
            >
              {c.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              )}
              <div className="flex-1">
                {c.done ? (
                  <span className="font-medium text-foreground/80 line-through decoration-emerald-500/60">
                    {c.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => jumpToAnchor(c.jumpTo)}
                    className="text-left font-semibold text-foreground hover:text-[hsl(var(--brand-magenta,328_82%_51%))] hover:underline"
                  >
                    {c.label}
                  </button>
                )}
              </div>
              {!c.done && (
                <button
                  type="button"
                  onClick={() => jumpToAnchor(c.jumpTo)}
                  className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--brand-magenta,328_82%_51%))] hover:underline"
                >
                  → Jump
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* Generate button — below the checklist */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            {allComplete
              ? gate.hasHigh
                ? `All required checks complete. ${gate.highCount} HIGH-severity warning${gate.highCount === 1 ? "" : "s"} will require confirmation.`
                : "All required checks complete. Dossier ready to generate."
              : `Complete ${incompleteLabels.length} more check${incompleteLabels.length === 1 ? "" : "s"} to unlock dossier generation.`}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={handleClick}
            title={tooltip}
            className={`inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all ${
              disabled
                ? "cursor-not-allowed bg-slate-400 opacity-60"
                : gate.hasHigh
                  ? "bg-gradient-to-r from-orange-500 via-[#E91E8C] to-[#9C27B0] shadow-lg hover:opacity-90"
                  : "bg-gradient-to-r from-[#00BCD4] via-[#9C27B0] to-[#E91E8C] shadow-lg hover:opacity-90"
            }`}
          >
            {disabled ? (
              <Lock className="h-4 w-4" />
            ) : gate.hasHigh ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <FileCheck2 className="h-4 w-4" />
            )}
            Generate Dossier
          </button>
        </div>
      </div>


      {highWarningOpen && (
        <HighWarningModal
          reasons={gate.highReasons}
          onCancel={() => setHighWarningOpen(false)}
          onProceed={() => {
            setHighWarningOpen(false);
            generate();
          }}
        />
      )}
    </>
  );
}

function HighWarningModal({
  reasons,
  onCancel,
  onProceed,
}: {
  reasons: string[];
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-sm border border-orange-400 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-border bg-orange-500 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                High-Severity Warning
              </div>
              <div className="text-sm font-semibold">
                {reasons.length} unresolved HIGH alert{reasons.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </header>
        <div className="space-y-3 p-4">
          <p className="text-xs leading-snug text-muted-foreground">
            The following HIGH-severity items are unresolved. You may proceed, but the dossier
            will carry these flags and lenders may request remediation before instruction.
          </p>
          <ul className="max-h-48 overflow-y-auto rounded-sm border border-orange-300 bg-orange-50 p-2 text-[11px] text-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-1.5 py-0.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              className="rounded-sm bg-gradient-to-r from-orange-500 via-[#E91E8C] to-[#9C27B0] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
            >
              Proceed anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
