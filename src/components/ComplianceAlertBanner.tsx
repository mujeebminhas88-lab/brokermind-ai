import { AlertTriangle, ShieldAlert, AlertOctagon } from "lucide-react";
import type { ComplianceVerdict } from "@/utils/documentRegistry";

/**
 * Compliance Alert banner — renders next to the active applicant's name when
 * the document-compliance engine surfaces HIGH or CRITICAL findings, including
 * statutory super-priority exposures (CRA payroll lien, GST/HST deemed trust).
 */
export function ComplianceAlertBanner({
  verdict,
  applicantName,
}: {
  verdict: ComplianceVerdict;
  applicantName?: string;
}) {
  if (!verdict.alerts.length) return null;

  const isCritical = verdict.highestSeverity === "CRITICAL" || verdict.blocking;
  const isHigh = verdict.highestSeverity === "HIGH";

  const tone = isCritical
    ? {
        wrap: "border-destructive bg-destructive/10 text-destructive",
        chip: "bg-destructive text-destructive-foreground",
        Icon: AlertOctagon,
        label: "CRITICAL — CROWN CHARGE / FUNDING BLOCK",
      }
    : isHigh
      ? {
          wrap: "border-warning bg-warning-bg text-warning-fg",
          chip: "bg-warning text-warning-foreground",
          Icon: ShieldAlert,
          label: "HIGH RISK — LIEN ALERT",
        }
      : {
          wrap: "border-border bg-muted text-foreground",
          chip: "bg-muted-foreground/20 text-foreground",
          Icon: AlertTriangle,
          label: "COMPLIANCE NOTICE",
        };

  const Icon = tone.Icon;

  return (
    <div
      className={`mb-4 flex flex-col gap-2 rounded-sm border px-4 py-3 ${tone.wrap}`}
      role="alert"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.chip}`}>
            {tone.label}
          </span>
          {applicantName && (
            <span className="text-xs font-semibold uppercase tracking-wide">
              · {applicantName}
            </span>
          )}
        </div>
        <span className="font-mono text-[11px]">
          {verdict.alerts.length} finding{verdict.alerts.length === 1 ? "" : "s"} · +
          {verdict.totalPenalty} pts
        </span>
      </div>
      <ul className="space-y-1 text-xs">
        {verdict.alerts.slice(0, 4).map((a) => (
          <li key={a.code} className="flex items-start gap-2">
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider opacity-80">
              {a.code}
            </span>
            <span>
              <strong>{a.label}.</strong> <span className="opacity-80">{a.detail}</span>
            </span>
          </li>
        ))}
        {verdict.alerts.length > 4 && (
          <li className="text-[11px] opacity-70">
            +{verdict.alerts.length - 4} additional finding(s) — see audit log.
          </li>
        )}
      </ul>
    </div>
  );
}
