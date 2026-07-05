import { useEffect, useMemo, useState } from "react";
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
  useEffect(() => { broker.load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);


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



  const generate = async () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const money = (n: number) =>
      n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
    let y = 40;

    const drawFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setDrawColor(CYAN);
        doc.setLineWidth(0.5);
        doc.line(40, H - 40, W - 40, H - 40);
        doc.setFontSize(7);
        doc.setTextColor("#94a3b8");
        doc.setFont("helvetica", "italic");
        doc.text(
          "AI-assisted underwriting preparation. All submission decisions remain with the licensed broker.",
          40,
          H - 28,
        );
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${p} of ${pageCount}`, W - 40, H - 28, { align: "right" });
      }
    };

    const pageBreakIfNeeded = (needed: number) => {
      if (y + needed > H - 60) {
        doc.addPage();
        y = 50;
      }
    };

    const section = (title: string, color: string) => {
      pageBreakIfNeeded(50);
      doc.setFillColor(color);
      doc.rect(40, y, W - 80, 22, "F");
      doc.setTextColor("#ffffff");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title.toUpperCase(), 48, y + 15);
      y += 32;
      doc.setTextColor("#0f172a");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    };

    const row = (l: string, v: string) => {
      pageBreakIfNeeded(18);
      doc.setTextColor("#64748b");
      doc.text(l, 48, y);
      doc.setTextColor("#0f172a");
      doc.setFont("helvetica", "bold");
      doc.text(v, W - 48, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 14;
    };

    const bullet = (text: string) => {
      pageBreakIfNeeded(16);
      const lines = doc.splitTextToSize(text, W - 100);
      doc.setTextColor("#334155");
      doc.text("•", 48, y);
      doc.text(lines, 60, y);
      y += lines.length * 12 + 2;
    };

    // ── COVER PAGE ─────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 180, "F");
    doc.setFillColor(CYAN);
    doc.rect(0, 180, W, 4, "F");
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("BrokerMind AI", 40, 90);
    doc.setFontSize(14);
    doc.setTextColor(CYAN);
    doc.text("Credit Qualification Dossier", 40, 118);
    doc.setFontSize(10);
    doc.setTextColor("#cbd5e1");
    doc.text("Confidential — For licensed broker & lender use", 40, 138);

    y = 220;
    doc.setTextColor("#0f172a");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(applicantName ?? "Unnamed Applicant", 40, y);
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor("#475569");
    doc.text(`Application ID: ${applicationNumber ?? "—"}`, 40, y);
    y += 16;
    doc.text(`Generated: ${new Date().toLocaleString("en-CA")}`, 40, y);
    y += 16;
    doc.text(`Broker: ${broker.broker_name || "—"}`, 40, y);
    y += 16;
    doc.text(`Licence: ${broker.licence_number || "—"}`, 40, y);
    y += 16;
    doc.text(`Brokerage: ${broker.brokerage_name || "—"}`, 40, y);
    y += 30;

    // ── 1 · EXECUTIVE SUMMARY ──────────────────────────────────────────
    section("1 · Executive Summary", CYAN);
    const propertyAddr = [property.street, property.city, property.province, property.postal]
      .filter(Boolean)
      .join(", ") || "—";
    row("Property Address", propertyAddr);
    row("Property Type / Tenure", `${property.kind} · ${property.tenure}`);
    row("Property Price", money(loan.propertyPrice));
    row("Down Payment", money(loan.downPayment));
    row("Loan Amount", money(Math.max(0, loan.propertyPrice - loan.downPayment)));
    row("LTV", `${derived.ltv.toFixed(2)}%`);
    row("GDS", `${derived.ds.gds.toFixed(2)}%`);
    row("TDS", `${derived.ds.tds.toFixed(2)}%`);
    row("Monthly P + I", money(derived.monthlyPI));
    row("Stress Test (MQR)", `${derived.stress.qualifyingRatePct.toFixed(2)}% · ${derived.stress.pass ? "PASS" : "FAIL"}`);
    y += 10;

    // ── 2 · INCOME & EMPLOYMENT ────────────────────────────────────────
    section("2 · Income & Employment", PURPLE);
    row("Employment Type", employmentType ?? "—");
    row("Primary Annual Income", money(loan.primaryAnnualIncome));
    if (loan.coApplicantEnabled) {
      row("Co-Applicant Annual Income", money(loan.coAnnualIncome));
    }
    row("Household Income (Qualifying)", money(derived.householdIncome));
    row("Rental Contribution (offset)", money(derived.rentalContribution));
    y += 10;

    // ── 3 · DOCUMENT REGISTRY ──────────────────────────────────────────
    section("3 · Document Registry", MAGENTA);
    if (docs.length === 0) {
      bullet("No documents on file.");
    } else {
      docs.forEach((d) => {
        const badge = d.status === "verified" ? "✓ Verified" : d.status === "review" ? "⚠ Review" : "· Pending";
        row(`${d.label}${d.mandatory ? " (mandatory)" : ""}`, badge);
      });
    }
    y += 10;

    // ── 4 · COMPLIANCE CHECKLIST ───────────────────────────────────────
    section("4 · Compliance Checklist", CYAN);
    checks.forEach((c) => {
      row(c.label, c.done ? "✓ Pass" : "✗ Incomplete");
    });
    y += 6;
    const overrides = alerts.filter((a) => a.overridden);
    if (overrides.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(MAGENTA);
      pageBreakIfNeeded(20);
      doc.text("Broker Overrides", 48, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setTextColor("#334155");
      overrides.forEach((o) => bullet(`${o.code} (${o.severity}) — ${o.detail}`));
    }
    y += 10;

    // ── 5 · RISK SCORECARD ─────────────────────────────────────────────
    section("5 · Risk Scorecard", PURPLE);
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
    row("Verdict", score >= 75 ? "APPROVE" : score >= 55 ? "CONDITIONAL" : "DECLINE / MANUAL");
    row("Beacon Tier", beaconTier(credit.beacon).label);
    row("Critical (blocking)", String(gate.criticalCount));
    row("High (warned)", String(gate.highCount));
    if (alerts.length > 0) {
      alerts.slice(0, 15).forEach((a) => bullet(`[${a.severity}] ${a.code} — ${a.label}`));
    }
    y += 10;

    // ── 6 · CONDITIONS SUMMARY ─────────────────────────────────────────
    section("6 · Conditions Summary", MAGENTA);
    if (conditions.length === 0) {
      bullet("No conditions recorded.");
    } else {
      conditions.forEach((c) => {
        row(c.label, c.status);
      });
    }
    y += 10;

    // ── 7 · AUDIT TRAIL SUMMARY ───────────────────────────────────────
    section("7 · Audit Trail Summary", CYAN);
    try {
      const { data: auditRows } = await supabase
        .from("audit_logs")
        .select("action, action_type, created_at, table_name, details")
        .eq("application_id", applicantId ?? "")
        .order("created_at", { ascending: false })
        .limit(15);
      if (!auditRows || auditRows.length === 0) {
        bullet("No audit events recorded for this application yet.");
      } else {
        auditRows.forEach((r) => {
          const ts = new Date(r.created_at as string).toLocaleString("en-CA");
          bullet(`${ts} · ${r.action_type ?? r.action} · ${r.table_name ?? "—"}`);
        });
      }
    } catch {
      bullet("Audit trail unavailable at export time.");
    }

    drawFooter();

    doc.save(
      `Dossier_${(applicantName ?? "applicant").replace(/\s+/g, "_")}_${Date.now()}.pdf`,
    );

    // Log EXPORT to audit trail
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (uid) {
        await supabase.from("audit_logs").insert({
          user_id: uid,
          application_id: applicantId ?? null,
          action: "DOSSIER_EXPORT",
          action_type: "EXPORT",
          entity_type: "dossier_pdf",
          entity_id: applicantId ?? null,
          table_name: "underwriting_applications",
          record_id: applicantId ?? null,
          details: {
            applicant_name: applicantName ?? null,
            score,
            highest_severity: verdict?.highestSeverity ?? "CLEAN",
            critical_count: gate.criticalCount,
            high_count: gate.highCount,
            at: new Date().toISOString(),
          },
        } as never);
      }
    } catch (err) {
      console.warn("Dossier export audit write failed", err);
    }

    toast.success("Dossier generated and export logged to audit trail.");
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
