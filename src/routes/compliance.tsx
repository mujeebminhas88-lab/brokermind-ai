import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/supabase/client";
import { AlertTriangle, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";


interface ComplianceAlert {
  id: string;
  application_id: string | null;
  alert_code: string;
  severity: string;
  message: string;
  document_code: string | null;
  details: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

interface AppRow {
  id: string;
  taxpayer_name: string;
  application_number: string;
  review_status: string;
}

export const Route = createFileRoute("/compliance")({
  component: () => (
    <AuthGate>
      <ComplianceDashboard />
    </AuthGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
});

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, WARN: 2, INFO: 3 };

function severityStyles(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "HIGH":
      return "border-chart-4/40 bg-chart-4/10 text-chart-4";
    case "WARN":
      return "border-warning/40 bg-warning-bg text-warning-fg";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function ComplianceDashboard() {
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [apps, setApps] = useState<Record<string, AppRow>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unresolved" | "all">("unresolved");
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  async function fetchData() {
    const [alertsRes, appsRes] = await Promise.all([
      supabase
        .from("compliance_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("underwriting_applications")
        .select("id, taxpayer_name, application_number, review_status"),
    ]);
    if (!alertsRes.error && alertsRes.data) setAlerts(alertsRes.data as ComplianceAlert[]);
    if (!appsRes.error && appsRes.data) {
      const map: Record<string, AppRow> = {};
      for (const a of appsRes.data as AppRow[]) map[a.id] = a;
      setApps(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("compliance-alerts-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compliance_alerts" },
        (payload) => {
          setLastEvent(new Date().toLocaleTimeString());
          fetchData();
          void payload;
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function resolveAlert(id: string) {
    const { error } = await supabase
      .from("compliance_alerts")
      .update({ resolved: true })
      .eq("id", id);
    if (!error) fetchData();
  }

  const visible = useMemo(() => {
    const list = filter === "unresolved" ? alerts.filter((a) => !a.resolved) : alerts;
    return [...list].sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity.toUpperCase()] ?? 9;
      const sb = SEVERITY_RANK[b.severity.toUpperCase()] ?? 9;
      if (sa !== sb) return sa - sb;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [alerts, filter]);

  const grouped = useMemo(() => {
    const m = new Map<string, ComplianceAlert[]>();
    for (const a of visible) {
      const key = a.application_id ?? "__unassigned";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    }
    return m;
  }, [visible]);

  const unresolvedCount = alerts.filter((a) => !a.resolved).length;
  const criticalCount = alerts.filter(
    (a) => !a.resolved && a.severity.toUpperCase() === "CRITICAL",
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        right={
          <>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </span>
            {lastEvent && <span className="font-mono">last event {lastEvent}</span>}
            <button
              onClick={fetchData}
              className="flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </>
        }
      />


      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Compliance Operations
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Forensic Alert Register
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live feed from the Forensic Parsing Engine. New CRA arrears, income variances,
              and crown-charge findings surface here in real time.
            </p>
          </div>
          <div className="flex gap-6">
            <Metric label="Open alerts" value={unresolvedCount} accent="text-foreground" />
            <Metric label="Critical" value={criticalCount} accent="text-destructive" />
            <Metric label="Applicants impacted" value={grouped.size} accent="text-foreground" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <FilterTab active={filter === "unresolved"} onClick={() => setFilter("unresolved")}>
            Unresolved
          </FilterTab>
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
            All history
          </FilterTab>
        </div>

        {loading ? (
          <div className="rounded-sm border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading compliance ledger…
          </div>
        ) : grouped.size === 0 ? (
          <div className="rounded-sm border border-border bg-card p-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
            <p className="mt-3 text-sm font-medium">No outstanding compliance issues.</p>
            <p className="text-xs text-muted-foreground">
              The parsing engine has not surfaced any unresolved findings.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([appId, list]) => {
              const app = appId !== "__unassigned" ? apps[appId] : undefined;
              return (
                <section
                  key={appId}
                  className="overflow-hidden rounded-sm border border-border bg-card"
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {app?.application_number ?? "Unassigned application"}
                      </p>
                      <p className="text-sm font-semibold tracking-tight">
                        {app?.taxpayer_name ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {app && (
                        <span className="rounded-sm border border-border bg-background px-2 py-1 uppercase tracking-wider text-muted-foreground">
                          {app.review_status}
                        </span>
                      )}
                      <span className="font-mono text-muted-foreground">
                        {list.length} finding{list.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </header>
                  <ul className="divide-y divide-border">
                    {list.map((a) => (
                      <li key={a.id} className="flex items-start gap-4 px-5 py-4">
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border ${severityStyles(a.severity)}`}
                        >
                          {a.severity.toUpperCase() === "CRITICAL" ? (
                            <ShieldAlert className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                              {a.alert_code}
                            </span>
                            <span
                              className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityStyles(a.severity)}`}
                            >
                              {a.severity}
                            </span>
                            {a.document_code && (
                              <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {a.document_code}
                              </span>
                            )}
                            {a.resolved && (
                              <span className="rounded-sm border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-success">
                                Resolved
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-foreground">{a.message}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(a.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!a.resolved && (
                          <button
                            onClick={() => resolveAlert(a.id)}
                            className="shrink-0 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Mark resolved
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function FilterTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}



