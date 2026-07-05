import { useState, useEffect } from "react";
import { X, FileText, Lock, ShieldCheck, Pencil } from "lucide-react";
import { useVerificationStore, docHasReviewRequired } from "@/store/verificationStore";
import { StatusBadge } from "./StatusBadge";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/auditLog";

interface Props {
  docId: string | null;
  onClose: () => void;
}

function ConfidenceBadge({ score }: { score: number }) {
  const low = score < 95;
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight ${
        low
          ? "border-yellow-500/60 bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300"
          : "border-emerald-500/60 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      }`}
    >
      {score}%
    </span>
  );
}

export function DocumentVerificationModal({ docId, onClose }: Props) {
  const doc = useVerificationStore((s) => s.docs.find((d) => d.id === docId) ?? null);
  const updateField = useVerificationStore((s) => s.updateField);
  const verify = useVerificationStore((s) => s.verify);
  const [local, setLocal] = useState<Record<string, string | number | boolean>>({});
  const [initial, setInitial] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    if (doc) {
      const init: Record<string, string | number | boolean> = {};
      for (const f of doc.fields) init[f.name] = f.value;
      setLocal(init);
      setInitial(init);
    }
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return null;
  const isLocked = doc.status === "verified";

  const commitAndVerify = async () => {
    const corrections: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of doc.fields) {
      if (local[f.name] !== f.value) {
        corrections[f.name] = { from: f.value, to: local[f.name] };
        updateField(doc.id, f.name, local[f.name]);
      }
    }
    verify(doc.id);
    await logAuditEvent({
      action_type: "VERIFY",
      table_name: "parsed_documents",
      record_id: doc.id,
      details: {
        kind: doc.kind,
        label: doc.label,
        manual_corrections: corrections,
      },
      old_value: initial,
      new_value: local,
    });
    toast.success(`${doc.label} verified & locked`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border bg-slate-900 px-5 py-3 text-white">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--brand-cyan))]" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Human-in-the-Loop Verification
              </div>
              <div className="text-sm font-bold">{doc.label} · {doc.kind.replace(/_/g, " ")}</div>
            </div>
            <StatusBadge status={doc.status} />
          </div>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
          {/* Left: original document viewer stub */}
          <div className="flex flex-col overflow-hidden border-r border-border bg-slate-100 dark:bg-slate-900">
            <div className="border-b border-border bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Original Document
            </div>
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="flex flex-col items-center gap-3 rounded-sm border-2 border-dashed border-slate-400/40 bg-card p-10 text-center shadow-inner">
                <FileText className="h-20 w-20 text-slate-400" />
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {doc.kind.replace(/_/g, " ")} Preview
                </div>
                <div className="max-w-xs text-xs text-muted-foreground">
                  Source document render. Attach a scanned PDF/image via the intake uploader to
                  display the original page here.
                </div>
              </div>
            </div>
          </div>

          {/* Right: editable fields */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Extracted Fields
              </span>
              {docHasReviewRequired(doc) && !isLocked && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                  Low-confidence fields present
                </span>
              )}
              {isLocked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                {doc.fields.map((f) => {
                  const low = f.confidence < 95;
                  const corrected = local[f.name] !== initial[f.name];
                  return (
                    <div
                      key={f.name}
                      className={`rounded-sm border p-3 transition-colors ${
                        corrected
                          ? "border-amber-500/70 bg-amber-100/80 dark:bg-amber-950/30"
                          : low
                          ? "border-yellow-500/60 bg-yellow-50 dark:bg-yellow-950/20"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {f.label}
                        </label>
                        <div className="flex items-center gap-1.5">
                          {corrected && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              <Pencil className="h-2.5 w-2.5" /> Manually Corrected
                            </span>
                          )}
                          {low && !corrected && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                              Review Required
                            </span>
                          )}
                          <ConfidenceBadge score={f.confidence} />
                        </div>
                      </div>
                      {f.type === "boolean" ? (
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={Boolean(local[f.name])}
                            onChange={(e) =>
                              setLocal((p) => ({ ...p, [f.name]: e.target.checked }))
                            }
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-xs">{local[f.name] ? "Yes" : "No"}</span>
                        </label>
                      ) : (
                        <input
                          type={f.type === "number" ? "number" : "text"}
                          disabled={isLocked}
                          value={local[f.name] === undefined ? "" : String(local[f.name])}
                          onChange={(e) =>
                            setLocal((p) => ({
                              ...p,
                              [f.name]:
                                f.type === "number" ? Number(e.target.value || 0) : e.target.value,
                            }))
                          }
                          className="w-full rounded-sm border border-input bg-card px-3 py-1.5 text-sm text-foreground disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
              <div className="text-[10px] text-muted-foreground">
                {isLocked ? "Document is verified and read-only." : "Locking marks all fields verified and satisfies the dossier gate for this document."}
              </div>
              <button
                onClick={commitAndVerify}
                disabled={isLocked}
                className="inline-flex items-center gap-2 rounded-sm bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" /> {isLocked ? "Verified" : "Verify & Lock"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
