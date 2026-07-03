import { useMemo, useState } from "react";
import { FileCheck2, Lock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { useVerificationStore } from "@/store/verificationStore";
import { useDerivedFinancials, useApplicationStore } from "@/store/applicationStore";
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
    if (gate.hasCritical) return; // hard block
    if (gate.hasHigh) {
      setHighWarningOpen(true);
      return;
    }
    generate();
  };

  const disabled = gate.hasCritical;
  const tooltip = disabled
    ? `Blocked by ${gate.criticalCount} CRITICAL alert${gate.criticalCount === 1 ? "" : "s"}: ${gate.criticalReasons.join(" · ")}`
    : undefined;

  return (
    <>
      <div className="rounded-sm border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--brand-cyan,187_100%_42%))]">
              Dossier Readiness Gate
            </div>
            <div className="text-sm font-semibold text-foreground">
              Generate Credit Qualification Dossier
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px]">
              <span
                className={
                  gate.criticalCount > 0
                    ? "flex items-center gap-1 rounded-sm bg-[#E91E8C] px-1.5 py-0.5 font-bold text-white"
                    : "flex items-center gap-1 text-muted-foreground"
                }
              >
                <ShieldAlert className="h-3 w-3" /> {gate.criticalCount} critical
              </span>
              <span className={gate.highCount > 0 ? "text-orange-600 font-semibold" : "text-muted-foreground"}>
                {gate.highCount} high
              </span>
              <span className={gate.warnCount > 0 ? "text-yellow-700" : "text-muted-foreground"}>
                {gate.warnCount} warn
              </span>
            </div>
            {gate.criticalReasons.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-[11px] text-destructive">
                {gate.criticalReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={handleClick}
              title={tooltip}
              className={`inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all ${
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
            {disabled && tooltip && (
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-72 rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-[10px] font-semibold text-destructive opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {tooltip}
              </div>
            )}
          </div>
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
