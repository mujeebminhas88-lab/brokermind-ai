import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase/client";
import { RefreshCw, GripVertical } from "lucide-react";

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

// Map UI columns -> DB review_status values (which are the source of truth).
const COLUMNS: { key: string; label: string; statuses: string[]; accent: string }[] = [
  {
    key: "collection",
    label: "Data Collection",
    statuses: ["Draft"],
    accent: "border-t-muted-foreground",
  },
  {
    key: "underwriting",
    label: "Underwriting",
    statuses: ["In Review"],
    accent: "border-t-chart-2",
  },
  {
    key: "compliance",
    label: "Compliance Review",
    statuses: ["Ready for Review"],
    accent: "border-t-warning",
  },
  {
    key: "approved",
    label: "Approved",
    statuses: ["Approved"],
    accent: "border-t-success",
  },
];

const ALL_STATUSES = ["Draft", "In Review", "Ready for Review", "Approved", "Declined"];

export const Route = createFileRoute("/pipeline")({
  component: PipelineBoard,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
});

function PipelineBoard() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [alerts, setAlerts] = useState<Record<string, AlertCount>>({});
  const [loading, setLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

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
      .channel("pipeline-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "underwriting_applications" },
        () => {
          setLastEvent(new Date().toLocaleTimeString());
          fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compliance_alerts" },
        () => {
          setLastEvent(new Date().toLocaleTimeString());
          fetchData();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<string, AppRow[]> = {};
    for (const col of COLUMNS) buckets[col.key] = [];
    const other: AppRow[] = [];
    for (const a of apps) {
      const col = COLUMNS.find((c) => c.statuses.includes(a.review_status));
      if (col) buckets[col.key].push(a);
      else other.push(a);
    }
    return { buckets, other };
  }, [apps]);

  async function moveTo(id: string, status: string) {
    if (!ALL_STATUSES.includes(status)) return;
    // optimistic
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, review_status: status } : a)));
    const { error } = await supabase
      .from("underwriting_applications")
      .update({ review_status: status })
      .eq("id", id);
    if (error) {
      // re-fetch to revert on failure (e.g. Incorporated trigger)
      fetchData();
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header lastEvent={lastEvent} onRefresh={fetchData} />

      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Adjudication Pipeline
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Application Flow Board</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag applicants between stages. Status changes write through to the underwriting
              ledger and update every connected workspace instantly.
            </p>
          </div>
          <div className="flex gap-6">
            {COLUMNS.map((c) => (
              <div key={c.key} className="text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {c.label}
                </p>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {grouped.buckets[c.key].length}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-6 py-6">
        {loading ? (
          <div className="rounded-sm border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading pipeline…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.key}
                label={col.label}
                accent={col.accent}
                onDrop={(id) => {
                  setDragging(null);
                  moveTo(id, col.statuses[0]);
                }}
                isDropping={dragging !== null}
              >
                {grouped.buckets[col.key].length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No applicants in this stage.
                  </p>
                ) : (
                  grouped.buckets[col.key].map((a) => (
                    <Card
                      key={a.id}
                      app={a}
                      alerts={alerts[a.id]}
                      onDragStart={() => setDragging(a.id)}
                      onDragEnd={() => setDragging(null)}
                    />
                  ))
                )}
              </Column>
            ))}
          </div>
        )}

        {grouped.other.length > 0 && (
          <section className="mt-6 rounded-sm border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Other statuses ({grouped.other.map((a) => a.review_status).join(", ")})
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {grouped.other.map((a) => (
                <Card key={a.id} app={a} alerts={alerts[a.id]} onDragStart={() => setDragging(a.id)} onDragEnd={() => setDragging(null)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Column({
  label,
  accent,
  children,
  onDrop,
  isDropping,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
  onDrop: (id: string) => void;
  isDropping: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/app-id");
        if (id) onDrop(id);
      }}
      className={`flex flex-col rounded-sm border bg-card ${over ? "border-foreground" : "border-border"} ${isDropping ? "ring-1 ring-border" : ""}`}
    >
      <div className={`border-t-2 ${accent} px-4 py-3`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
          {label}
        </p>
      </div>
      <div className="flex-1 space-y-2 p-3">{children}</div>
    </div>
  );
}

function Card({
  app,
  alerts,
  onDragStart,
  onDragEnd,
}: {
  app: AppRow;
  alerts?: AlertCount;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const risk = app.aggregate_risk_score ?? 0;
  const riskColor =
    risk >= 75
      ? "text-destructive border-destructive/40 bg-destructive/10"
      : risk >= 50
        ? "text-chart-4 border-chart-4/40 bg-chart-4/10"
        : risk >= 30
          ? "text-warning-fg border-warning/40 bg-warning-bg"
          : "text-success border-success/40 bg-success/10";
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/app-id", app.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group cursor-grab rounded-sm border border-border bg-background p-3 transition hover:border-foreground active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {app.application_number}
          </p>
          <p className="truncate text-sm font-semibold tracking-tight">{app.taxpayer_name}</p>
        </div>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {app.employment_type}
        </span>
        <span
          className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${riskColor}`}
        >
          Risk {risk}
        </span>
        {alerts && alerts.open > 0 && (
          <Link
            to="/compliance"
            className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              alerts.critical > 0
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-warning/40 bg-warning-bg text-warning-fg"
            }`}
          >
            {alerts.critical > 0 ? `${alerts.critical} critical` : `${alerts.open} alerts`}
          </Link>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
        <Stat label="GDS" value={`${(Number(app.gds) * 100).toFixed(1)}%`} />
        <Stat label="TDS" value={`${(Number(app.tds) * 100).toFixed(1)}%`} />
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Header({
  lastEvent,
  onRefresh,
}: {
  lastEvent: string | null;
  onRefresh: () => void;
}) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-semibold tracking-tight">
            BrokerMind<span className="text-primary">AI</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
            <NavLink to="/">Workspace</NavLink>
            <NavLink to="/compliance">Compliance</NavLink>
            <NavLink to="/pipeline">Pipeline</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live subscription
          </span>
          {lastEvent && <span className="font-mono">last event {lastEvent}</span>}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-sm px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      activeProps={{ className: "bg-foreground text-background hover:bg-foreground hover:text-background" }}
      activeOptions={{ exact: true }}
    >
      {children}
    </Link>
  );
}
