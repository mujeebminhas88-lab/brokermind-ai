import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { NewApplicationModal } from "@/components/NewApplicationModal";
import { LayoutGrid, List, Plus, RefreshCw, Search, Star, Zap } from "lucide-react";

const STAGES = [
  "New",
  "Documents Requested",
  "In Review",
  "Conditions Issued",
  "Approved",
  "Funded",
  "Declined",
  "Withdrawn",
] as const;

type Stage = (typeof STAGES)[number];

const STAGE_TONE: Record<string, string> = {
  New: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  Draft: "bg-muted text-muted-foreground border-border",
  "Documents Requested": "bg-warning-bg text-warning-fg border-warning/30",
  "In Review": "bg-chart-4/10 text-chart-4 border-chart-4/30",
  "Ready for Review": "bg-chart-4/10 text-chart-4 border-chart-4/30",
  "Conditions Issued": "bg-warning-bg text-warning-fg border-warning/30",
  Approved: "bg-success/10 text-success border-success/30",
  Funded: "bg-success/20 text-success border-success/40",
  Declined: "bg-destructive/10 text-destructive border-destructive/30",
  Withdrawn: "bg-muted text-muted-foreground border-border",
};

interface AppRow {
  id: string;
  application_number: string;
  taxpayer_name: string;
  review_status: string;
  employment_type: string;
  aggregate_risk_score: number;
  gds: number;
  tds: number;
  loan_amount: number;
  property_address: string | null;
  province: string | null;
  lender_name: string | null;
  is_priority: boolean;
  deal_type: string | null;
  updated_at: string;
  created_at: string;
}

interface RateHoldRow {
  application_id: string | null;
  expiry_date: string;
}

interface SavedFilter {
  name: string;
  status: string;
  risk: string;
  stream: string;
  province: string;
  rateHoldDays: string;
  sort: string;
  query: string;
}

type View = "board" | "table";

export const Route = createFileRoute("/pipeline")({
  component: () => (
    <AuthGate>
      <PipelinePage />
    </AuthGate>
  ),
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
  validateSearch: (s: Record<string, unknown>) => ({
    risk: typeof s.risk === "string" ? s.risk : undefined,
  }),
});

const STORAGE_KEY = "bm-pipeline-filters";

function PipelinePage() {
  const navigate = useNavigate();
  const { risk: riskParam } = Route.useSearch();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [rateHolds, setRateHolds] = useState<RateHoldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [view, setView] = useState<View>("board");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [risk, setRisk] = useState<string>(riskParam ?? "ALL");
  const [stream, setStream] = useState("ALL");
  const [province, setProvince] = useState("ALL");
  const [rateHoldDays, setRateHoldDays] = useState("ALL");
  const [sort, setSort] = useState("updated");

  const [saved, setSaved] = useState<SavedFilter[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  async function fetchData() {
    setLoading(true);
    const [appsRes, holdsRes] = await Promise.all([
      supabase
        .from("underwriting_applications")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("rate_holds").select("application_id, expiry_date"),
    ]);
    if (appsRes.data) setApps(appsRes.data as unknown as AppRow[]);
    if (holdsRes.data) setRateHolds(holdsRes.data as RateHoldRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void fetchData();
    const ch = supabase
      .channel("pipeline-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "underwriting_applications" }, fetchData)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const holdByApp = useMemo(() => {
    const m: Record<string, number> = {};
    const now = Date.now();
    for (const h of rateHolds) {
      if (!h.application_id) continue;
      const days = Math.ceil((new Date(h.expiry_date).getTime() - now) / 864e5);
      if (!(h.application_id in m) || days < m[h.application_id]) m[h.application_id] = days;
    }
    return m;
  }, [rateHolds]);

  function riskTier(score: number): "low" | "elevated" | "high" {
    if (score >= 60) return "high";
    if (score >= 30) return "elevated";
    return "low";
  }

  function lenderStream(a: AppRow): "prime" | "alt" | "private" {
    const s = (a.aggregate_risk_score ?? 0);
    if (s >= 60) return "private";
    if (s >= 40) return "alt";
    return "prime";
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = apps.filter((a) => {
      if (status !== "ALL" && a.review_status !== status) return false;
      if (risk !== "ALL" && riskTier(a.aggregate_risk_score) !== risk) return false;
      if (stream !== "ALL" && lenderStream(a) !== stream) return false;
      if (province !== "ALL" && (a.province ?? "").toUpperCase() !== province) return false;
      if (rateHoldDays !== "ALL") {
        const d = holdByApp[a.id];
        const limit = Number(rateHoldDays);
        if (d === undefined || d > limit) return false;
      }
      if (!q) return true;
      return (
        a.taxpayer_name.toLowerCase().includes(q) ||
        a.application_number.toLowerCase().includes(q) ||
        (a.property_address ?? "").toLowerCase().includes(q) ||
        (a.lender_name ?? "").toLowerCase().includes(q)
      );
    });
    list = list.slice().sort((a, b) => {
      switch (sort) {
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "risk":
          return (b.aggregate_risk_score ?? 0) - (a.aggregate_risk_score ?? 0);
        case "hold": {
          const ad = holdByApp[a.id] ?? Infinity;
          const bd = holdByApp[b.id] ?? Infinity;
          return ad - bd;
        }
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
    return list;
  }, [apps, query, status, risk, stream, province, rateHoldDays, sort, holdByApp]);

  const stats = useMemo(() => {
    const byStage: Record<string, number> = {};
    STAGES.forEach((s) => (byStage[s] = 0));
    let totalValue = 0;
    for (const a of apps) {
      byStage[a.review_status] = (byStage[a.review_status] ?? 0) + 1;
      totalValue += Number(a.loan_amount) || 0;
    }
    const now = Date.now();
    const weekAgo = now - 7 * 864e5;
    const thisWeekNew = apps.filter((a) => new Date(a.created_at).getTime() >= weekAgo).length;
    const thisWeekApproved = apps.filter((a) => a.review_status === "Approved" && new Date(a.updated_at).getTime() >= weekAgo).length;
    const thisWeekDeclined = apps.filter((a) => a.review_status === "Declined" && new Date(a.updated_at).getTime() >= weekAgo).length;
    return { byStage, totalValue, thisWeekNew, thisWeekApproved, thisWeekDeclined, total: apps.length };
  }, [apps]);

  function open(id: string) {
    navigate({ to: "/", search: { app: id } as never });
  }

  async function togglePriority(a: AppRow) {
    await supabase.from("underwriting_applications").update({ is_priority: !a.is_priority }).eq("id", a.id);
    fetchData();
  }

  function saveFilter() {
    const name = prompt("Filter name");
    if (!name) return;
    const next = [
      ...saved,
      { name, status, risk, stream, province, rateHoldDays, sort, query },
    ];
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function applyFilter(f: SavedFilter) {
    setStatus(f.status);
    setRisk(f.risk);
    setStream(f.stream);
    setProvince(f.province);
    setRateHoldDays(f.rateHoldDays);
    setSort(f.sort);
    setQuery(f.query);
  }

  function deleteFilter(name: string) {
    const next = saved.filter((f) => f.name !== name);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <NewApplicationModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={(id) => open(id)}
      />

      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pipeline</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Application Workflow</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-sm border border-border bg-card p-0.5">
              <button
                onClick={() => setView("board")}
                className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider ${
                  view === "board" ? "bg-chart-2/15 text-chart-2" : "text-muted-foreground"
                }`}
              >
                <LayoutGrid className="h-3 w-3" /> Board
              </button>
              <button
                onClick={() => setView("table")}
                className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider ${
                  view === "table" ? "bg-chart-2/15 text-chart-2" : "text-muted-foreground"
                }`}
              >
                <List className="h-3 w-3" /> Table
              </button>
            </div>
            <button
              onClick={() => setModal(true)}
              className="inline-flex items-center gap-1.5 rounded-sm bg-chart-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black"
            >
              <Plus className="h-3.5 w-3.5" /> New Application
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1800px] px-6 pb-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Metric label="Total Files" value={stats.total} />
            <Metric label="Pipeline Value" value={`$${(stats.totalValue / 1000).toFixed(0)}K`} accent="text-success" />
            <Metric label="New" value={stats.byStage["New"] ?? 0} accent="text-chart-2" />
            <Metric label="This Week — New" value={stats.thisWeekNew} accent="text-chart-2" />
            <Metric label="Approved (7d)" value={stats.thisWeekApproved} accent="text-success" />
            <Metric label="Declined (7d)" value={stats.thisWeekDeclined} accent="text-destructive" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, app #, address, lender…"
              className="w-80 rounded-sm border border-border bg-card py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <Select value={status} onChange={setStatus} options={["ALL", ...STAGES]} label="Status" />
          <Select value={risk} onChange={setRisk} options={["ALL", "low", "elevated", "high"]} label="Risk" />
          <Select value={stream} onChange={setStream} options={["ALL", "prime", "alt", "private"]} label="Stream" />
          <Select value={province} onChange={setProvince} options={["ALL", "ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "NL", "PE"]} label="Prov" />
          <Select value={rateHoldDays} onChange={setRateHoldDays} options={["ALL", "3", "7", "14", "30"]} label="Hold ≤" />
          <Select
            value={sort}
            onChange={setSort}
            options={["updated", "created", "risk", "hold"]}
            label="Sort"
          />
          <button
            onClick={saveFilter}
            className="rounded-sm border border-border bg-card px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider hover:bg-muted"
          >
            Save filter
          </button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {filtered.length} of {apps.length}
          </span>
        </div>

        {saved.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Saved:</span>
            {saved.map((f) => (
              <span
                key={f.name}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-[10.5px]"
              >
                <button onClick={() => applyFilter(f)} className="hover:text-chart-2">
                  {f.name}
                </button>
                <button
                  onClick={() => deleteFilter(f.name)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="delete filter"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {view === "board" ? (
          <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-4">
            {STAGES.map((stage) => {
              const items = filtered.filter((a) => a.review_status === stage);
              return (
                <div key={stage} className="rounded-sm border border-border bg-card">
                  <header className={`flex items-center justify-between border-b border-border px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider ${STAGE_TONE[stage] ?? ""}`}>
                    <span>{stage}</span>
                    <span className="rounded-sm bg-background/50 px-1.5 py-0.5 font-mono">{items.length}</span>
                  </header>
                  <ul className="max-h-[560px] space-y-2 overflow-y-auto p-2">
                    {items.length === 0 ? (
                      <li className="rounded-sm border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                        Empty
                      </li>
                    ) : (
                      items.map((a) => <Card key={a.id} a={a} holdDays={holdByApp[a.id]} onOpen={() => open(a.id)} onStar={() => togglePriority(a)} />)
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <TableView apps={filtered} holdByApp={holdByApp} open={open} />
        )}
      </div>
    </div>
  );
}

function Card({
  a,
  holdDays,
  onOpen,
  onStar,
}: {
  a: AppRow;
  holdDays?: number;
  onOpen: () => void;
  onStar: () => void;
}) {
  const holdWarn = holdDays !== undefined && holdDays <= 10;
  return (
    <li className="cursor-pointer rounded-sm border border-border bg-background p-2.5 hover:border-chart-2/50" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStar();
              }}
              className={a.is_priority ? "text-chart-4" : "text-muted-foreground hover:text-chart-4"}
              aria-label="priority"
            >
              <Star className="h-3 w-3" fill={a.is_priority ? "currentColor" : "none"} />
            </button>
            <div className="truncate text-xs font-medium">{a.taxpayer_name}</div>
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{a.property_address ?? "—"}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] tabular-nums">${((Number(a.loan_amount) || 0) / 1000).toFixed(0)}K</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
        <span className="rounded-sm border border-border bg-muted/50 px-1 py-0.5 font-mono uppercase tracking-wider text-muted-foreground">
          {a.application_number}
        </span>
        <span className="rounded-sm border border-border bg-muted/50 px-1 py-0.5 uppercase tracking-wider text-muted-foreground">
          Risk {a.aggregate_risk_score}
        </span>
        {holdWarn && (
          <span className="inline-flex items-center gap-0.5 rounded-sm border border-warning/40 bg-warning-bg px-1 py-0.5 font-semibold uppercase tracking-wider text-warning-fg">
            <Zap className="h-2.5 w-2.5" />
            {holdDays}d hold
          </span>
        )}
      </div>
    </li>
  );
}

function TableView({
  apps,
  holdByApp,
  open,
}: {
  apps: AppRow[];
  holdByApp: Record<string, number>;
  open: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-3 py-3">Application</th>
            <th className="px-3 py-3">Applicant</th>
            <th className="px-3 py-3">Property</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">Loan</th>
            <th className="px-3 py-3 text-right">Risk</th>
            <th className="px-3 py-3 text-right">GDS/TDS</th>
            <th className="px-3 py-3">Hold</th>
            <th className="px-3 py-3">Updated</th>
          </tr>
        </thead>
        <tbody>
          {apps.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-xs text-muted-foreground">
                No files match the current filters.
              </td>
            </tr>
          ) : (
            apps.map((a) => {
              const hold = holdByApp[a.id];
              return (
                <tr
                  key={a.id}
                  onClick={() => open(a.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {a.is_priority && <Star className="mr-1 inline h-3 w-3 text-chart-4" fill="currentColor" />}
                    {a.application_number}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{a.taxpayer_name}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.property_address ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${STAGE_TONE[a.review_status] ?? "border-border bg-background text-muted-foreground"}`}>
                      {a.review_status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    ${((Number(a.loan_amount) || 0) / 1000).toFixed(0)}K
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{a.aggregate_risk_score}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs">
                    {(Number(a.gds) * 100).toFixed(1)} / {(Number(a.tds) * 100).toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {hold !== undefined ? (
                      <span className={hold <= 10 ? "font-semibold text-warning-fg" : "text-muted-foreground"}>{hold}d</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground">
                    {new Date(a.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-sm border border-border bg-background p-3">
      <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl tabular-nums ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm border border-border bg-card px-2 py-1 text-xs text-foreground"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
