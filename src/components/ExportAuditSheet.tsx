import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import type { NoaAnalysis } from "@/utils/noaParser";

const EMERALD: [number, number, number] = [4, 78, 56];
const EMERALD_LIGHT: [number, number, number] = [16, 122, 90];
const INK: [number, number, number] = [18, 24, 22];
const MUTED: [number, number, number] = [110, 120, 116];
const RULE: [number, number, number] = [210, 215, 212];

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(n);

export function ExportAuditSheetButton({
  analysis,
  applicationNumber,
  taxpayerName,
  gds,
  tds,
  aggregateRiskScore,
}: {
  analysis: NoaAnalysis | null;
  applicationNumber: string;
  taxpayerName: string;
  gds: number;
  tds: number;
  aggregateRiskScore: number;
}) {
  const [exporting, setExporting] = useState(false);

  function generate() {
    setExporting(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 48;
      let y = 0;

      // ── Header band
      doc.setFillColor(...EMERALD);
      doc.rect(0, 0, W, 78, "F");
      doc.setFillColor(...EMERALD_LIGHT);
      doc.rect(0, 78, W, 4, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("BrokerMindAI", M, 36);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Automated Mortgage Underwriting & Compliance Report", M, 52);
      doc.setFontSize(7.5);
      doc.setTextColor(200, 225, 215);
      doc.text("OSFI B-20 ALIGNED · CONFIDENTIAL ADJUDICATION ARTIFACT", M, 66);

      // Right column meta in header
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      const rightX = W - M;
      doc.text(`APP ${applicationNumber}`, rightX, 36, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(new Date().toLocaleString("en-CA"), rightX, 52, { align: "right" });

      y = 110;

      // ── Meta strip
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.5);
      const metaRows: [string, string][] = [
        ["Application Number", applicationNumber],
        ["Insured / Lender Type", "Conventional · Schedule I Lender"],
        ["Underwriter", "M. Chen, AMP · Senior Adjudicator"],
        ["Generation Timestamp", new Date().toISOString()],
      ];
      doc.setFontSize(7.5);
      metaRows.forEach(([k, v], i) => {
        const yy = y + i * 14;
        doc.setTextColor(...MUTED);
        doc.setFont("helvetica", "bold");
        doc.text(k.toUpperCase(), M, yy);
        doc.setTextColor(...INK);
        doc.setFont("helvetica", "normal");
        doc.text(v, M + 150, yy);
      });
      y += metaRows.length * 14 + 8;
      doc.setDrawColor(...RULE);
      doc.line(M, y, W - M, y);
      y += 18;

      // Helper
      const sectionTitle = (n: string, title: string) => {
        if (y > H - 120) { doc.addPage(); y = M; }
        doc.setFillColor(...EMERALD);
        doc.rect(M, y - 10, 3, 12, "F");
        doc.setTextColor(...MUTED);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(n, M + 10, y - 2);
        doc.setTextColor(...INK);
        doc.setFontSize(11);
        doc.text(title, M + 32, y);
        y += 16;
        doc.setDrawColor(...RULE);
        doc.line(M, y, W - M, y);
        y += 14;
      };

      const kvRow = (k: string, v: string) => {
        if (y > H - 60) { doc.addPage(); y = M; }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(k, M, y);
        doc.setTextColor(...INK);
        doc.setFont("helvetica", "bold");
        doc.text(v, W - M, y, { align: "right" });
        y += 14;
        doc.setDrawColor(238, 240, 238);
        doc.line(M, y - 4, W - M, y - 4);
      };

      const payload = analysis?.payload;
      const tp = payload?.taxpayer_name ?? taxpayerName;
      const taxYear = payload?.tax_year ?? 2024;
      const l15 = payload?.line_15000_total_income ?? 94500;
      const l23 = payload?.line_23600_net_income ?? 88940.12;

      // ── Section 1
      sectionTitle("01", "Financial Assessment");
      kvRow("Taxpayer Name", tp);
      kvRow("Tax Year", String(taxYear));
      kvRow("Line 15000 — Total Income", fmtCurrency(l15));
      kvRow("Line 23600 — Net Income", fmtCurrency(l23));
      kvRow("GDS Ratio", `${gds.toFixed(2)} %`);
      kvRow("TDS Ratio", `${tds.toFixed(2)} %`);
      y += 12;

      // ── Section 2
      sectionTitle("02", "OSFI B-20 Risk Analytics");
      // score card
      if (y > H - 90) { doc.addPage(); y = M; }
      doc.setFillColor(245, 248, 246);
      doc.rect(M, y - 4, W - 2 * M, 46, "F");
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("AGGREGATE RISK SCORE", M + 12, y + 10);
      doc.setTextColor(...EMERALD);
      doc.setFontSize(22);
      doc.text(String(aggregateRiskScore), M + 12, y + 32);
      doc.setTextColor(...MUTED);
      doc.setFontSize(7.5);
      doc.text("/ 100  ·  Lower = stronger covenant", M + 60, y + 32);
      y += 58;

      const flags = analysis?.flags ?? [];
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`Triggered Risk Flags (${flags.length})`, M, y);
      y += 12;

      if (flags.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text("No active risk flags. Covenant within tolerance bands.", M, y);
        y += 16;
      } else {
        flags.forEach((f) => {
          if (y > H - 70) { doc.addPage(); y = M; }
          doc.setFillColor(...EMERALD_LIGHT);
          doc.rect(M, y - 8, 2, 24, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...INK);
          doc.text(`${f.code}  ·  ${f.title}`, M + 8, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...MUTED);
          doc.text(`Severity: ${f.severity}   Penalty: +${f.penalty}`, M + 8, y + 11);
          const detailLines = doc.splitTextToSize(f.detail, W - 2 * M - 12);
          doc.setTextColor(...INK);
          doc.setFontSize(8);
          doc.text(detailLines, M + 8, y + 24);
          y += 24 + detailLines.length * 10 + 8;
        });
      }
      y += 8;

      // ── Section 3
      sectionTitle("03", "Automated Underwriting Conditions");
      const cond = analysis?.draftedCondition;
      if (!cond) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text("No auto-drafted condition for current payload.", M, y);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        doc.text(`${cond.id} — ${cond.title}`, M, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(`Category: ${cond.category}`, M, y + 11);
        y += 24;

        const drafts: [string, string][] = [
          ["Internal Credit Note", cond.internal],
          ["Broker Portal", cond.broker],
          ["Borrower Email", cond.borrower],
        ];
        drafts.forEach(([label, body]) => {
          if (y > H - 80) { doc.addPage(); y = M; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(...EMERALD);
          doc.text(label.toUpperCase(), M, y);
          y += 10;
          doc.setFillColor(248, 250, 249);
          const lines = doc.splitTextToSize(body, W - 2 * M - 16);
          const blockH = lines.length * 10 + 14;
          doc.rect(M, y - 2, W - 2 * M, blockH, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...INK);
          doc.text(lines, M + 8, y + 10);
          y += blockH + 10;
        });
      }

      // ── Footer on every page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...RULE);
        doc.line(M, H - 36, W - M, H - 36);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text("BrokerMindAI · Confidential · For internal adjudication use only", M, H - 22);
        doc.text(`Page ${i} of ${pageCount}`, W - M, H - 22, { align: "right" });
      }

      const safeApp = applicationNumber.replace(/[^A-Za-z0-9_-]+/g, "_");
      doc.save(`BrokerMindAI_Audit_${safeApp}.pdf`);
      toast.success("Underwriting audit sheet exported successfully.");
    } catch (e: any) {
      toast.error("Export failed", { description: e?.message ?? "Could not generate PDF" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={generate}
      disabled={exporting}
      className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] font-bold tracking-tight border disabled:opacity-60"
      style={{
        borderColor: "var(--emerald-deep)",
        color: "var(--emerald-deep)",
        background: "transparent",
      }}
    >
      <FileDown className="h-3.5 w-3.5" strokeWidth={2.5} />
      {exporting ? "Compiling…" : "Export Audit Sheet (PDF)"}
    </button>
  );
}
