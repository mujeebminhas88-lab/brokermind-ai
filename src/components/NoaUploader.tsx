import { useRef, useState } from "react";
import { Upload, FileCheck2, AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import {
  analyzeNoticeOfAssessment,
  NoaPayloadSchema,
  type NoaAnalysis,
} from "@/utils/noaParser";

const FORENSIC_FAILURE_MSG =
  "Forensic Extraction Failure: The document could not be verified against the OSFI B-20 NOA data contract. Please ensure you are uploading an authentic, clear CRA document.";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:<mime>;base64," prefix
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export function NoaUploader({
  analysis,
  applicationId = "APP-2025-08842",
  analyzing,
  onAnalyzed,
  onAnalyzingChange,
  onClear,
}: {
  analysis: NoaAnalysis | null;
  applicationId?: string;
  analyzing: boolean;
  onAnalyzed: (a: NoaAnalysis) => void;
  onAnalyzingChange: (busy: boolean) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    onAnalyzingChange(true);
    try {
      const fileData = await fileToBase64(file);

      const { data, error: fnError } = await supabase.functions.invoke(
        "process-noa",
        {
          body: {
            fileData,
            fileName: file.name,
            mimeType: file.type,
            application_id: applicationId,
          },
        },
      );

      if (fnError) throw new Error(fnError.message || "Edge function error");

      if (!data || typeof data !== "object") {
        throw new Error("Empty response from extraction service.");
      }

      if ("error" in data && data.error) {
        throw new Error(
          typeof (data as { message?: string }).message === "string"
            ? (data as { message: string }).message
            : String((data as { error: unknown }).error),
        );
      }

      const payload = NoaPayloadSchema.parse(
        (data as { payload: unknown }).payload,
      );
      const result = analyzeNoticeOfAssessment(payload);
      onAnalyzed(result);
      toast.success("NOA verified", {
        description: `${result.flags.length} flag(s) · +${result.aggregatePenalty} pts`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown extraction error.";
      setError(msg);
      toast.error("Forensic Extraction Failure", {
        description: FORENSIC_FAILURE_MSG,
        duration: 8000,
      });
    } finally {
      onAnalyzingChange(false);
    }
  }

  const busy = analyzing;

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
                INTAKE · {applicationId}
              </span>
              <h2 className="text-[13px] font-bold tracking-tight">
                Upload Notice of Assessment
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              PDF, image, or structured JSON · processed by process-noa edge pipeline
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
            if (busy) return;
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
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--emerald)" }} />
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
                  ? "AI Analyzing Document · OCR + schema validation…"
                  : error
                    ? "Extraction rejected"
                    : analysis
                      ? `Validated · ${analysis.flags.length} flag(s) · +${analysis.aggregatePenalty} pts`
                      : "Awaiting document"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="border border-border bg-card px-3 py-1.5 text-[11px] font-semibold tracking-tight hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Processing…" : "Browse"}
            </button>
            {analysis && !busy && (
              <button
                onClick={() => {
                  setFileName(null);
                  setError(null);
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
          <span className="font-mono">{FORENSIC_FAILURE_MSG} ({error})</span>
        </div>
      )}
    </div>
  );
}
