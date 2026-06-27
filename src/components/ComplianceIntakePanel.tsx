import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, FileInput } from "lucide-react";
import {
  DocumentRegistry,
  aggregateCompliance,
  getRegistryByCategory,
  CATEGORY_ORDER,
  processDocument,
  type ComplianceVerdict,
  type DocumentKind,
  type FieldSpec,
  type ProcessedDocument,
  type RawDocument,
} from "@/utils/documentRegistry";

/**
 * Document Compliance Intake — Master Registry surface.
 *
 * The dropdown groups every registered document by category and the form
 * fields below it are rendered dynamically from each entry's `fields` spec.
 * Adding a new tax form requires only a new entry in DocumentRegistry —
 * no UI changes here.
 */

type FormValues = Record<string, string | number | boolean>;

const defaultsFor = (specs: FieldSpec[]): FormValues => {
  const out: FormValues = {};
  for (const f of specs) {
    // Start every field blank — no seeded sample values bleeding into the UI.
    out[f.name] = f.type === "number" ? 0 : f.type === "boolean" ? false : "";
  }
  return out;
};


interface Props {
  applicantId?: string | null;
  onVerdictChange?: (verdict: ComplianceVerdict | null) => void;
}

export function ComplianceIntakePanel({ applicantId, onVerdictChange }: Props) {
  const [docs, setDocs] = useState<ProcessedDocument[]>([]);
  const [selectedKind, setSelectedKind] = useState<DocumentKind>("T1");
  const grouped = useMemo(() => getRegistryByCategory(), []);
  const entry = DocumentRegistry[selectedKind];
  const [values, setValues] = useState<FormValues>(() => defaultsFor(entry.fields));

  // Reset the dynamic form whenever the user picks a new document kind.
  useEffect(() => {
    setValues(defaultsFor(DocumentRegistry[selectedKind].fields));
  }, [selectedKind]);

  const verdict = useMemo(() => aggregateCompliance(docs), [docs]);

  useEffect(() => {
    onVerdictChange?.(docs.length === 0 ? null : verdict);
  }, [verdict, docs.length, onVerdictChange]);

  const ingest = (payloadOverride?: Record<string, unknown>) => {
    const raw: RawDocument = {
      kind: selectedKind,
      applicantId: applicantId ?? undefined,
      payload: payloadOverride ?? (values as Record<string, unknown>),
      source: `manual:${selectedKind}`,
    };
    const processed = processDocument(raw);
    setDocs((prev) => [...prev, processed]);

    const crit = processed.alerts.find((a) => a.severity === "CRITICAL");
    const high = processed.alerts.find((a) => a.severity === "HIGH");
    if (crit) toast.error(`${crit.code} — ${crit.label}`, { description: crit.detail });
    else if (high) toast.warning(`${high.code} — ${high.label}`, { description: high.detail });
    else
      toast.success(`${DocumentRegistry[selectedKind].label} processed`, {
        description: processed.alerts.length
          ? `${processed.alerts.length} finding(s) logged.`
          : "No compliance findings.",
      });
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

  const setField = (name: string, v: string | number | boolean) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <section className="rounded-sm border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Master Document Registry — Compliance Intake
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
          {verdict.blocking ? "CROWN CHARGE — BLOCK" : (verdict.highestSeverity ?? "CLEAN")}
          {" · +"}
          {verdict.totalPenalty} pts
        </span>
      </header>

      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[280px_1fr]">
        {/* Categorized dropdown */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Document Type
          </label>
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value as DocumentKind)}
            className="rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
              <optgroup key={cat} label={cat}>
                {grouped[cat].map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/_/g, " ")} — {DocumentRegistry[k].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="rounded-sm border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="font-semibold uppercase tracking-wider text-foreground">
              {entry.category}
            </div>
            <div className="mt-1">{entry.label}</div>
          </div>
          <label className="mt-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-input bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-muted">
            <Upload className="h-3.5 w-3.5" /> Upload JSON Payload
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

        {/* Dynamic form rendered from FieldSpec[] */}
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.fields.map((f) => (
              <div key={f.name} className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </label>
                {f.type === "boolean" ? (
                  <label className="inline-flex h-9 items-center gap-2 rounded-sm border border-input bg-card px-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(values[f.name])}
                      onChange={(e) => setField(f.name, e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-xs text-muted-foreground">
                      {values[f.name] ? "Yes" : "No"}
                    </span>
                  </label>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={values[f.name] === undefined ? "" : String(values[f.name])}
                    onChange={(e) =>
                      setField(
                        f.name,
                        f.type === "number" ? Number(e.target.value || 0) : e.target.value,
                      )
                    }
                    className="rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
                {f.hint && <span className="text-[10px] text-muted-foreground">{f.hint}</span>}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => ingest()}
              className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
            >
              <FileInput className="h-3.5 w-3.5" /> Ingest {selectedKind.replace(/_/g, " ")}
            </button>
          </div>
        </div>
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
                    {d.kind.replace(/_/g, " ")}
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
