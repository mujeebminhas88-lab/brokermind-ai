import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";
import {
  DocumentRegistry,
  aggregateCompliance,
  processDocument,
  type ComplianceVerdict,
  type DocumentKind,
  type ProcessedDocument,
  type RawDocument,
} from "@/utils/documentRegistry";

/**
 * Document Compliance Intake
 *
 * Lightweight ingest surface that exercises the DocumentRegistry without
 * touching the existing T1 / T2125 tabs. Each ingest call runs:
 *   1. registry extractor for the selected document kind
 *   2. registry validator
 *   3. runSuperPriorityChecks (payroll / GST-HST lien scan)
 *
 * Results are accumulated into a ComplianceVerdict surfaced upward so the
 * dashboard can render the alert banner next to the applicant.
 */

const DOC_KINDS: DocumentKind[] = Object.keys(DocumentRegistry) as DocumentKind[];

const SAMPLE_PAYLOADS: Record<DocumentKind, Record<string, unknown>> = {
  T2: { corporationName: "Acme Holdings Ltd.", taxYear: 2024, businessNumber: "123456789RC0001" },
  T2_SCH1: { line_9999: 84200 },
  T2_SCH100: { field_2599: 2_450_000, field_3499: 1_980_000 },
  T2_SCH125: { field_8299: 1_850_000, field_9369: 84200 },
  T1: { taxpayerName: "Mujeeb Minhas", taxYear: 2024, line_13500: 62000, line_15000: 124500, line_23600: 118000 },
  T2125: { businessName: "Minhas Consulting", part1Gross: 180000, part5Net: 62000 },
  T5013: { box010: "P-2245-789", box020: 100, box116: 48500, box122: 0 },
  T4A: { payerName: "Crown Holdings", box048: 24500 },
  T1204: { box82: 38000, box84: 42000 },
  NOA: {
    taxpayer_name: "Mujeeb Minhas",
    tax_year: 2024,
    line_15000_total_income: 124500,
    line_23600_net_income: 118000,
    balance_owing_at_assessment: 4250,
    has_unarranged_arrears: true,
  },
  PD7A: { payrollAccount: "123456789RP0001", outstandingDeductions: 12450, period: "2025-04" },
  RC59: { businessNumber: "123456789", outstandingDeductions: 0 },
  NET34: { businessNumber: "123456789RT0001", period: "2025-Q1", netTaxOwing: 31200 },
};

interface Props {
  applicantId?: string | null;
  onVerdictChange?: (verdict: ComplianceVerdict | null) => void;
}

export function ComplianceIntakePanel({ applicantId, onVerdictChange }: Props) {
  const [docs, setDocs] = useState<ProcessedDocument[]>([]);
  const [selectedKind, setSelectedKind] = useState<DocumentKind>("PD7A");

  const verdict = useMemo(() => aggregateCompliance(docs), [docs]);

  // Propagate verdict to parent.
  useEffect(() => {
    onVerdictChange?.(docs.length === 0 ? null : verdict);
  }, [verdict, docs.length, onVerdictChange]);

  const ingest = (payloadOverride?: Record<string, unknown>) => {
    const raw: RawDocument = {
      kind: selectedKind,
      applicantId: applicantId ?? undefined,
      payload: payloadOverride ?? SAMPLE_PAYLOADS[selectedKind],
      source: `manual:${selectedKind}`,
    };
    const processed = processDocument(raw);
    setDocs((prev) => [...prev, processed]);

    const crit = processed.alerts.find((a) => a.severity === "CRITICAL");
    const high = processed.alerts.find((a) => a.severity === "HIGH");
    if (crit) {
      toast.error(`${crit.code} — ${crit.label}`, { description: crit.detail });
    } else if (high) {
      toast.warning(`${high.code} — ${high.label}`, { description: high.detail });
    } else {
      toast.success(`${DocumentRegistry[selectedKind].label} processed`, {
        description: processed.alerts.length
          ? `${processed.alerts.length} finding(s) logged.`
          : "No compliance findings.",
      });
    }
  };

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Record<string, unknown>;
      ingest(payload);
    } catch {
      toast.error("Forensic Extraction Failure", {
        description: "File must be a JSON payload matching the document schema.",
      });
    }
  };

  return (
    <section className="rounded-sm border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Document Compliance Engine
          </h2>
          <p className="text-xs text-muted-foreground">
            Registry-driven extract → validate → super-priority lien scan
          </p>
        </div>
        <span
          className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            verdict.blocking
              ? "border-destructive bg-destructive/10 text-destructive"
              : verdict.highestSeverity === "HIGH"
                ? "border-warning bg-warning-bg text-warning-fg"
                : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {verdict.blocking
            ? "CROWN CHARGE — BLOCK"
            : verdict.highestSeverity ?? "CLEAN"}
          {" · +"}
          {verdict.totalPenalty} pts
        </span>
      </header>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto]">
        <select
          value={selectedKind}
          onChange={(e) => setSelectedKind(e.target.value as DocumentKind)}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {DOC_KINDS.map((k) => (
            <option key={k} value={k}>
              {k} — {DocumentRegistry[k].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => ingest()}
          className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Upload className="h-3.5 w-3.5" /> Ingest Sample
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-input bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-muted">
          <Upload className="h-3.5 w-3.5" /> Upload JSON
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {docs.length > 0 && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Ingested documents ({docs.length})</span>
            <button
              type="button"
              onClick={() => setDocs([])}
              className="inline-flex items-center gap-1 text-destructive hover:underline"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
          <ul className="divide-y divide-border">
            {docs.map((d, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {d.kind}
                  </span>
                  <span className="text-foreground">{DocumentRegistry[d.kind].label}</span>
                </div>
                <span
                  className={`font-mono text-[11px] ${
                    d.alerts.some((a) => a.severity === "CRITICAL")
                      ? "text-destructive"
                      : d.alerts.some((a) => a.severity === "HIGH")
                        ? "text-warning-fg"
                        : "text-muted-foreground"
                  }`}
                >
                  {d.alerts.length === 0 ? "clean" : `${d.alerts.length} finding(s)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
