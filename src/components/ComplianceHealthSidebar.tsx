import { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Activity,
  CheckCircle2,
  Unlock,
  Lock,
  Info,
} from "lucide-react";
import { useTaxSlipStore } from "@/store/taxSlipStore";
import { supabase } from "@/supabase/client";
import { toast } from "sonner";
import type { ComplianceVerdict } from "@/utils/documentRegistry";
import {
  useComplianceAlerts,
  type UnifiedAlert,
} from "@/hooks/useComplianceAlerts";

function jumpTo(anchor: string) {
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

const sevStyle = {
  CRITICAL:
    "border-l-4 border-[#E91E8C] border border-destructive/60 bg-destructive/10 text-destructive",
  HIGH: "border-orange-400/60 bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  WARN: "border-yellow-500/50 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300",
} as const;

export function ComplianceHealthSidebar({
  verdict,
  employmentComplete,
  applicantId,
}: {
  verdict: ComplianceVerdict | null;
  employmentComplete: boolean;
  applicantId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<UnifiedAlert | null>(null);
  const setOverride = useTaxSlipStore((s) => s.setOverride);
  const clearOverride = useTaxSlipStore((s) => s.clearOverride);

  const alerts = useComplianceAlerts({ verdict, employmentComplete, applicantId });

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed right-0 top-1/3 z-30 flex items-center gap-2 rounded-l-sm border border-r-0 border-border bg-card px-2 py-3 shadow-md hover:bg-muted"
        aria-label="Open compliance health sidebar"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-rl]">
          Health · {alerts.length}
        </span>
      </button>
    );
  }

  const critical = alerts.filter((a) => a.severity === "CRITICAL" && a.blocking).length;
  const high = alerts.filter((a) => a.severity === "HIGH" && a.blocking).length;
  const warn = alerts.filter((a) => a.severity === "WARN").length;

  return (
    <>
      <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-80 flex-col rounded-sm border border-border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[hsl(var(--brand-cyan,187_100%_42%))]" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Compliance Health
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={
                    critical > 0
                      ? "rounded-sm bg-[#E91E8C] px-1.5 py-0.5 text-white"
                      : "text-slate-400"
                  }
                >
                  {critical} critical
                </span>
                <span className="text-slate-500">·</span>
                <span className={high > 0 ? "text-orange-300" : "text-slate-400"}>
                  {high} high
                </span>
                <span className="text-slate-500">·</span>
                <span className={warn > 0 ? "text-yellow-300" : "text-slate-400"}>
                  {warn} warn
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-sm p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {alerts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <div className="text-sm font-semibold text-foreground">All Clear</div>
              <div className="max-w-[16rem] text-xs text-muted-foreground">
                No compliance flags detected. Continue verifying documents to unlock the dossier.
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {alerts.map((a, i) => (
                <li
                  key={`${a.code}-${i}`}
                  className={`rounded-sm border p-2.5 ${sevStyle[a.severity]} ${a.overridden ? "opacity-60" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {a.severity === "CRITICAL" ? (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      ) : a.severity === "HIGH" ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <Info className="h-3.5 w-3.5" />
                      )}
                      <span className="font-mono text-[10px] font-bold">{a.code}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase">
                      {a.overridden ? "OVERRIDDEN" : a.severity}
                    </span>
                  </div>
                  <div className="text-xs font-semibold leading-snug text-foreground">
                    {a.label}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {a.detail}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    {a.jumpTo && (
                      <button
                        onClick={() => jumpTo(a.jumpTo!)}
                        className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--brand-magenta,328_82%_51%))] hover:underline"
                      >
                        → Jump to field
                      </button>
                    )}
                    {a.overridable && !a.overridden && (
                      <button
                        onClick={() => setOverrideTarget(a)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--brand-cyan,187_100%_42%))] hover:underline"
                      >
                        <Unlock className="h-3 w-3" /> Override
                      </button>
                    )}
                    {a.overridden && (
                      <button
                        onClick={() => {
                          clearOverride(a.code);
                          toast.info("Override cleared");
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:underline"
                      >
                        <Lock className="h-3 w-3" /> Clear override
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {overrideTarget && (
        <OverrideModal
          alert={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onSubmit={async (note) => {
            setOverride(overrideTarget.code, note);
            try {
              await supabase.from("compliance_alerts").insert({
                application_id: applicantId ?? null,
                alert_code: `${overrideTarget.code}:OVERRIDE`,
                severity: "INFO",
                message: `Override on ${overrideTarget.code} (${overrideTarget.severity}): ${note}`,
                details: {
                  original_code: overrideTarget.code,
                  original_severity: overrideTarget.severity,
                  note,
                  at: new Date().toISOString(),
                },
                resolved: true,
              });
            } catch (err) {
              console.warn("Audit log write failed", err);
            }
            toast.success("Override logged to audit trail");
            setOverrideTarget(null);
          }}
        />
      )}
    </>
  );
}

function OverrideModal({
  alert,
  onClose,
  onSubmit,
}: {
  alert: UnifiedAlert;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const minChars = alert.severity === "CRITICAL" ? 20 : 10;
  const valid = trimmed.length >= minChars;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-sm border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className={`border-b border-border px-4 py-3 text-white ${
            alert.severity === "CRITICAL" ? "bg-[#E91E8C]" : "bg-slate-900"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            {alert.severity} Override
          </div>
          <div className="text-sm font-semibold">{alert.label}</div>
        </header>
        <div className="space-y-3 p-4">
          <p className="text-xs leading-snug text-muted-foreground">{alert.detail}</p>
          {alert.severity === "CRITICAL" && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              <strong>CRITICAL override.</strong> This alert hard-blocks dossier generation.
              Overriding requires a detailed broker note ({minChars}+ chars) and is permanently
              logged to the audit trail.
            </div>
          )}
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Broker note (required, min {minChars} chars)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={
                alert.severity === "CRITICAL"
                  ? 'e.g. "Client entered CRA payment arrangement Nov 2025; confirmation letter uploaded to Doc-CRA-2025-PA."'
                  : 'e.g. "Lender has confirmed exception approval, ref #12345."'
              }
              className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="mt-1 text-[10px] text-muted-foreground">
              {trimmed.length}/{minChars}
            </div>
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              disabled={!valid}
              onClick={() => onSubmit(trimmed)}
              className={`rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white ${
                valid
                  ? alert.severity === "CRITICAL"
                    ? "bg-[#E91E8C] hover:opacity-90"
                    : "bg-gradient-to-r from-[#00BCD4] via-[#9C27B0] to-[#E91E8C] hover:opacity-90"
                  : "cursor-not-allowed bg-slate-400 opacity-60"
              }`}
            >
              Log Override
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
