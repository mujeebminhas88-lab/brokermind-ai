import { useRef, useState } from "react";
import { Upload, FileCheck2, AlertTriangle, Loader2, X } from "lucide-react";
import {
  analyzeNoticeOfAssessment,
  simulateParseNoaFromFile,
  type NoaAnalysis,
} from "@/utils/noaParser";

export function NoaUploader({
  analysis,
  onAnalyzed,
  onClear,
}: {
  analysis: NoaAnalysis | null;
  onAnalyzed: (a: NoaAnalysis) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const payload = await simulateParseNoaFromFile(file);
      const result = analyzeNoticeOfAssessment(payload);
      onAnalyzed(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to parse NOA payload.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-border bg-card">
      <div className="flex flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center text-primary-foreground"
            style={{ background: "var(--emerald-deep)" }}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                INTAKE
              </span>
              <h2 className="text-[13px] font-bold tracking-tight">
                Upload Notice of Assessment
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              PDF, image, or structured JSON · validated against OSFI B-20 NOA contract
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex flex-1 items-center justify-between gap-3 border border-dashed px-4 py-2.5 transition-colors lg:max-w-2xl ${
            dragOver ? "bg-secondary" : "bg-secondary/40"
          }`}
          style={{ borderColor: dragOver ? "var(--emerald)" : "var(--border)" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {busy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : analysis ? (
              <FileCheck2 className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />
            ) : (
              <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="truncate font-mono text-[11.5px] font-semibold">
                {fileName ?? "Drop NOA file or click Browse"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {busy
                  ? "Running OCR + schema validation…"
                  : error
                    ? "Validation failed"
                    : analysis
                      ? `Validated · ${analysis.flags.length} flag(s) · +${analysis.aggregatePenalty} pts`
                      : "Awaiting document"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="border border-border bg-card px-3 py-1.5 text-[11px] font-semibold tracking-tight hover:bg-secondary"
            >
              Browse
            </button>
            {analysis && (
              <button
                onClick={() => {
                  setFileName(null);
                  onClear();
                }}
                className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Clear analysis"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.json,application/pdf,application/json,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 border-t px-6 py-2 text-[11px]"
          style={{
            borderColor: "var(--warning)",
            background: "var(--warning-bg)",
            color: "var(--warning-fg)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">
            Schema rejection: {error}
          </span>
        </div>
      )}
    </div>
  );
}
