import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase/client";
import { RefreshCw, ArrowUpRight, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

interface AppRow {
  id: string;
  application_number: string;
  taxpayer_name: string;
  review_status: string;
  employment_type: string;
  aggregate_risk_score: number;
  gds: number;
  tds: number;
  updated_at: string;
}

interface AlertCount {
  application_id: string;
  open: number;
  critical: number;
}

export const Route = createFileRoute("/pipeline")({
  component: PipelineTable,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
});

function PipelineTable() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [alerts, setAlerts] = useState<Record<string, AlertCount>>({});
  const [loading, setLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  async function fetchData() {
    const [appsRes, alertsRes] = await Promise.all([
      supabase
        .from("underwriting_applications")
        .select(
          "id, application_number, taxpayer_name, review_status, employment_type, aggregate_risk_score, gds, tds, updated_at",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("compliance_alerts")
        .select("application_id, severity, resolved")
        .eq("resolved", false),
    ]);
    if (!appsRes.error && appsRes.data) setApps(appsRes.data as AppRow[]);
    if (!alertsRes.error && alertsRes.data) {
      const m: Record<string, AlertCount> = {};
      for (const a of alertsRes.data as { application_id: string | null; severity: string; resolved: boolean }[]) {
        if (!a.application_id) continue;
        if (!m[a.application_id]) m[a.application_id] = { application_id: a.application_id, open: 0, critical: 0 };
        m[a.application_id].open += 1;
        if (a.severity.toUpperCase() === "CRITICAL") m[a.application_id].critical += 1;
      }
      setAlerts(m);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("pipeline-table-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "underwriting_applications" }, () => {
        setLastEvent(new Date().toLocaleTimeString());
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "compliance_alerts" }, () => {
        setLastEvent(new Date().toLocaleTimeString());
        fetchData();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    apps.forEach((a) => s.add(a.review_status));
    return Array.from(s);
  }, [apps]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter !== "ALL" && a.review_status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.taxpayer_name.toLowerCase().includes(q) ||
        a.application_number.toLowerCase().includes(q)
      );
    });
  }, [apps, query, statusFilter]);

  const totals = useMemo(() => {
    return {
      total: apps.length,
      flagged: Object.keys(alerts).length,
      critical: Object.values(alerts).reduce((s, a) => s + a.critical, 0),
    };
  }, [apps, alerts]);

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
              className="flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/10"
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </>
        }
      />

      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pipeline</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">All Applications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tabular ledger of every underwriting file. Click a row to open it in the workspace.
            </p>
          </div>
          <div className="flex gap-6">
            <Metric label="Total" value={totals.total} />
            <Metric label="Flagged" value={totals.flagged} accent="text-chart-4" />
            <Metric label="Critical" value={totals.critical} accent="text-destructive" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search taxpayer or application #"
              className="w-72 rounded-sm border border-border bg-card py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-sm border border-border bg-card px-2 py-1.5 text-xs"
          >
            <option value="ALL">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {rows.length} of {apps.length} shown
          </span>
        </div>

        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Employment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Risk</th>
                <th className="px-4 py-3 text-right">GDS</th>
                <th className="px-4 py-3 text-right">TDS</th>
                <th className="px-4 py-3">Alerts</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    Loading pipeline…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No applications match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((a) => {
                  const al = alerts[a.id];
                  const risk = a.aggregate_risk_score ?? 0;
                  const riskTone =
                    risk >= 75 ? "text-destructive" : risk >= 50 ? "text-chart-4" : risk >= 30 ? "text-warning-fg" : "text-success";
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {a.application_number}
                      </td>
                      <td className="px-4 py-3 font-medium">{a.taxpayer_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.employment_type}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {a.review_status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono tabular-nums ${riskTone}`}>{risk}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {(Number(a.gds) * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {(Number(a.tds) * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        {al && al.open > 0 ? (
                          <Link
                            to="/compliance"
                            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              al.critical > 0
                                ? "border-destructive/40 bg-destructive/10 text-destructive"
                                : "border-warning/40 bg-warning-bg text-warning-fg"
                            }`}
                          >
                            {al.critical > 0 ? `${al.critical} critical` : `${al.open} open`}
                          </Link>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {new Date(a.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:text-foreground"
                          style={{ color: "var(--brand-cyan)" }}
                        >
                          Open <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl font-semibold tabular-nums ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
