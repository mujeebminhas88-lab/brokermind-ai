import { useMemo, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { useVerificationStore, docHasReviewRequired } from "@/store/verificationStore";
import { useApplicationStore, useDerivedFinancials } from "@/store/applicationStore";
import type { ComplianceVerdict } from "@/utils/documentRegistry";

interface Alert {
  code: string;
  label: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "WARN";
  jumpTo?: string;
}

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
  CRITICAL: "border-destructive bg-destructive/10 text-destructive",
  HIGH: "border-orange-400/60 bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  WARN: "border-yellow-500/50 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300",
} as const;

export function ComplianceHealthSidebar({
  verdict,
  employmentComplete,
}: {
  verdict: ComplianceVerdict | null;
  employmentComplete: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const docs = useVerificationStore((s) => s.docs);
  const loan = useApplicationStore((s) => s.loan);
  const derived = useDerivedFinancials();

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];

    // From verification pipeline
    for (const d of docs.filter(docHasReviewRequired)) {
      if (d.status === "verified") continue;
      out.push({
        code: `DOC-${d.kind}`,
        label: `${d.label} — Fields need review`,
        detail: `${d.fields.filter((f) => f.confidence < 95).length} low-confidence field(s).`,
        severity: "WARN",
        jumpTo: "compliance-intake",
      });
    }

    // From the compliance verdict
    if (verdict) {
      for (const a of verdict.alerts.slice(0, 8)) {
        out.push({
          code: a.code,
          label: a.label,
          detail: a.detail,
          severity:
            a.severity === "CRITICAL" ? "CRITICAL" : a.severity === "HIGH" ? "HIGH" : "WARN",
          jumpTo: "compliance-intake",
        });
      }
    }

    // Missing employment info
    if (!employmentComplete) {
      out.push({
        code: "EMPL-INCOMPLETE",
        label: "Employment registry incomplete",
        detail: "Household income or amortization is missing. Complete loan terms panel.",
        severity: "HIGH",
        jumpTo: "loan-terms",
      });
    }

    // Ratio breaches
    if (derived.ds.gdsExceeded) {
      out.push({
        code: "GDS-BREACH",
        label: "GDS exceeds 39%",
        detail: `Current GDS ${derived.ds.gds.toFixed(1)}%. Reduce housing costs or add income.`,
        severity: "HIGH",
        jumpTo: "loan-terms",
      });
    }
    if (derived.ds.tdsExceeded) {
      out.push({
        code: "TDS-BREACH",
        label: "TDS exceeds 44%",
        detail: `Current TDS ${derived.ds.tds.toFixed(1)}%. Address debt load.`,
        severity: "HIGH",
        jumpTo: "loan-terms",
      });
    }
    if (derived.ltv > 80) {
      out.push({
        code: "LTV-HIGH",
        label: "LTV exceeds 80%",
        detail: `LTV ${derived.ltv.toFixed(1)}%. Insured mortgage required.`,
        severity: "WARN",
        jumpTo: "loan-terms",
      });
    }

    // Missing mandatory docs
    if (loan.propertyPrice === 0) {
      out.push({
        code: "MISSING-PRICE",
        label: "Property price missing",
        detail: "Enter property price to compute LTV.",
        severity: "WARN",
        jumpTo: "loan-terms",
      });
    }

    return out;
  }, [docs, verdict, employmentComplete, derived, loan.propertyPrice]);

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

  const critical = alerts.filter((a) => a.severity === "CRITICAL").length;
  const high = alerts.filter((a) => a.severity === "HIGH").length;

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-80 flex-col rounded-sm border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[hsl(var(--brand-cyan,187_100%_42%))]" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Compliance Health
            </div>
            <div className="text-xs font-semibold">
              {critical} critical · {high} high · {alerts.length} total
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
                className={`rounded-sm border p-2.5 ${sevStyle[a.severity]}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {a.severity === "CRITICAL" ? (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    <span className="font-mono text-[10px] font-bold">{a.code}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase">{a.severity}</span>
                </div>
                <div className="text-xs font-semibold leading-snug text-foreground">{a.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {a.detail}
                </div>
                {a.jumpTo && (
                  <button
                    onClick={() => jumpTo(a.jumpTo!)}
                    className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--brand-magenta,328_82%_51%))] hover:underline"
                  >
                    → Jump to field
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
