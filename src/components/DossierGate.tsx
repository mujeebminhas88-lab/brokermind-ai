import { useMemo } from "react";
import { FileCheck2, Lock } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { useVerificationStore } from "@/store/verificationStore";
import { useDerivedFinancials, useApplicationStore } from "@/store/applicationStore";
import type { ComplianceVerdict } from "@/utils/documentRegistry";

interface Props {
  applicantName?: string | null;
  applicationNumber?: string | null;
  verdict: ComplianceVerdict | null;
  employmentComplete: boolean;
}

const CYAN = "#00BCD4";
const MAGENTA = "#E91E8C";
const PURPLE = "#9C27B0";

export function DossierGate({
  applicantName,
  applicationNumber,
  verdict,
  employmentComplete,
}: Props) {
  const docs = useVerificationStore((s) => s.docs);
  const derived = useDerivedFinancials();
  const loan = useApplicationStore((s) => s.loan);

  const gate = useMemo(() => {
    const reasons: string[] = [];
    const mandatory = docs.filter((d) => d.mandatory);
    if (mandatory.length === 0) reasons.push("At least one mandatory document required");
    else if (mandatory.some((d) => d.status !== "verified"))
      reasons.push("All mandatory documents must be Verified");
    if (verdict?.blocking) reasons.push("Blocking compliance alerts must be resolved");
    if (!employmentComplete) reasons.push("Employment / loan terms incomplete");
    if (!applicantName) reasons.push("Applicant name required");
    return { ready: reasons.length === 0, reasons };
  }, [docs, verdict, employmentComplete, applicantName]);

  const generate = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    let y = 40;

    // Header band
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

    // Applicant
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
    row("Blocking Alerts", verdict?.blocking ? "YES" : "No");
    row("Documents Verified", `${docs.filter((d) => d.status === "verified").length} / ${docs.length}`);
    y += 10;

    section("Scorecard", CYAN);
    const score = Math.max(
      0,
      100 - (verdict?.totalPenalty ?? 0) - (derived.ds.gdsExceeded ? 10 : 0) -
        (derived.ds.tdsExceeded ? 10 : 0) - (derived.ltv > 80 ? 5 : 0),
    );
    row("Composite Adjudication Score", `${score} / 100`);
    row(
      "Verdict",
      score >= 75 ? "APPROVE" : score >= 55 ? "CONDITIONAL" : "DECLINE / MANUAL",
    );

    // Footer
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

  return (
    <div className="rounded-sm border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--brand-cyan,187_100%_42%))]">
            Dossier Readiness Gate
          </div>
          <div className="text-sm font-semibold text-foreground">
            Generate Credit Qualification Dossier
          </div>
          {!gate.ready && (
            <ul className="mt-2 list-inside list-disc text-[11px] text-muted-foreground">
              {gate.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          disabled={!gate.ready}
          onClick={generate}
          className={`inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all ${
            gate.ready
              ? "bg-gradient-to-r from-[#00BCD4] via-[#9C27B0] to-[#E91E8C] shadow-lg hover:opacity-90"
              : "cursor-not-allowed bg-slate-400 opacity-60"
          }`}
        >
          {gate.ready ? <FileCheck2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          Generate Dossier
        </button>
      </div>
    </div>
  );
}
