import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, FileInput, Eye } from "lucide-react";
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
import { useVerificationStore, seedConfidence, docHasReviewRequired } from "@/store/verificationStore";
import { StatusBadge } from "./StatusBadge";
import { DocumentVerificationModal } from "./DocumentVerificationModal";
import { useFirmContext } from "@/hooks/useFirmContext";
import { ingestUpload } from "@/lib/documentIngestPipeline";

const MANDATORY_KINDS = new Set<DocumentKind>(["T1", "NOA", "T4"]);

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
  onApplicantNameChange?: (name: string) => void;
}

const NAME_FIELDS = new Set([
  "taxpayerName",
  "corporationName",
  "trustName",
  "partnershipName",
]);

export function ComplianceIntakePanel({ applicantId, onVerdictChange, onApplicantNameChange }: Props) {
  const [docs, setDocs] = useState<ProcessedDocument[]>([]);
  const [selectedKind, setSelectedKind] = useState<DocumentKind>("T1");
  const grouped = useMemo(() => getRegistryByCategory(), []);
  const entry = DocumentRegistry[selectedKind];
  const [values, setValues] = useState<FormValues>(() => defaultsFor(entry.fields));
  const verificationDocs = useVerificationStore((s) => s.docs);
  const addVerificationDoc = useVerificationStore((s) => s.addDoc);
  const removeVerificationDoc = useVerificationStore((s) => s.remove);
  const clearVerification = useVerificationStore((s) => s.clear);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const { firmId } = useFirmContext();
  const [uploading, setUploading] = useState(false);

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

    // Register in verification store with seeded per-field confidence.
    const payload = (payloadOverride ?? values) as Record<string, unknown>;
    const specEntry = DocumentRegistry[selectedKind];
    const verifId = addVerificationDoc({
      kind: selectedKind,
      label: specEntry.label,
      mandatory: MANDATORY_KINDS.has(selectedKind),
      fields: specEntry.fields.map((f) => {
        const confidence = seedConfidence(selectedKind, f.name);
        const raw = payload[f.name];
        const value =
          f.type === "number"
            ? Number(raw ?? 0)
            : f.type === "boolean"
              ? Boolean(raw)
              : String(raw ?? "");
        return { name: f.name, label: f.label, type: f.type, value, confidence };
      }),
      status: "pending",
    });
    // Move to "review" if any confidence < 95, else "uploaded".
    setTimeout(() => {
      const state = useVerificationStore.getState();
      const d = state.docs.find((x) => x.id === verifId);
      if (d) state.setStatus(verifId, docHasReviewRequired(d) ? "review" : "uploaded");
    }, 400);


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
    setUploading(true);
    try {
      const result = await ingestUpload({ file, kind: selectedKind, firmId, applicationId: applicantId });
      if (result.ok) {
        ingest(result.payload);
      } else {
        toast.error("Forensic Extraction Failure", { description: result.error });
      }
    } catch (e) {
      toast.error("Forensic Extraction Failure", {
        description: e instanceof Error ? e.message : "Document extraction failed.",
      });
    } finally {
      setUploading(false);
    }
  };

  const setField = (name: string, v: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    if (NAME_FIELDS.has(name) && typeof v === "string") onApplicantNameChange?.(v);
  };

  return (
    <section id="compliance-intake" className="scroll-mt-24 rounded-sm border border-border bg-card shadow-sm">

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
          <label
            className={`mt-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-input bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-muted ${
              uploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Processing…" : "Upload Document"}
            <input
              type="file"
              accept="application/pdf,.pdf,image/jpeg,image/jpg,image/png,image/heic,image/heif,image/tiff,image/webp,application/json,.json"
              className="hidden"
              disabled={uploading}
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

      {verificationDocs.length > 0 && (
        <div className="border-t border-border">
          {(() => {
            const verifiedCount = verificationDocs.filter((v) => v.status === "verified").length;
            const reviewCount = verificationDocs.filter((v) => v.status === "review").length;
            const pendingCount = verificationDocs.filter((v) => v.status === "pending" || v.status === "uploaded").length;
            return (
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-700 dark:text-emerald-400">{verifiedCount} Verified</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-orange-700 dark:text-orange-400">{reviewCount} Review Required</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-warning-fg">{pendingCount} Pending</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearVerification();
                    setDocs([]);
                  }}
                  className="inline-flex items-center gap-1 text-destructive hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              </div>
            );
          })()}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Kind</th>
                  <th className="px-3 py-2 text-left font-semibold">Label</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Findings</th>
                  <th className="px-5 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {verificationDocs.map((v, i) => {
                  const processed = docs[i];
                  const findings = processed?.alerts.length ?? 0;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setOpenDocId(v.id)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <td className="px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {v.kind.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-foreground">{v.label}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={v.status} />
                      </td>
                      <td
                        className={`px-3 py-2 font-mono text-[11px] ${
                          findings === 0 ? "text-muted-foreground" : "text-warning-fg"
                        }`}
                      >
                        {findings === 0 ? "clean" : `${findings} finding(s)`}
                      </td>
                      <td className="px-5 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDocId(v.id);
                          }}
                          className="mr-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--brand-cyan,187_100%_42%))] hover:underline"
                        >
                          <Eye className="h-3 w-3" /> Verify
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeVerificationDoc(v.id);
                            setDocs((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="text-[10px] font-semibold uppercase tracking-wider text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DocumentVerificationModal docId={openDocId} onClose={() => setOpenDocId(null)} />
    </section>
  );
}

