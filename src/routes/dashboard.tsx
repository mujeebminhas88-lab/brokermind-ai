import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { NewApplicationModal } from "@/components/NewApplicationModal";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { AlertTriangle, Calendar, DollarSign, FileText, Plus, TrendingUp, Zap } from "lucide-react";

interface AppRow {
  id: string;
  application_number: string;
  taxpayer_name: string;
  review_status: string;
  loan_amount: number;
  aggregate_risk_score: number;
  is_priority: boolean;
  updated_at: string;
  property_address: string | null;
}

interface AlertRow {
  application_id: string | null;
  severity: string;
  resolved: boolean;
}

interface RateHoldRow {
  application_id: string | null;
  expiry_date: string;
}

interface RenewalRow {
  id: string;
  client_name: string | null;
  maturity_date: string | null;
  renewal_status: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  entity_type: string | null;
  application_id: string | null;
  created_at: string;
  details: unknown;
}

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AuthGate>
      <DashboardView />
    </AuthGate>
  ),
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
  head: () => ({
    meta: [
      { title: "Deal Summary — BrokerMind AI" },
      { name: "description", content: "Broker book overview: active files, pipeline value, rate holds, renewals, and recent activity." },
    ],
  }),
});

const ACTIVE_STATUSES = new Set([
  "New",
  "Draft",
  "Documents Requested",
  "In Review",
  "Ready for Review",
  "Conditions Issued",
  "Approved",
]);

function DashboardView() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [rateHolds, setRateHolds] = useState<RateHoldRow[]>([]);
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    const [a, al, rh, rn, au] = await Promise.all([
      supabase
        .from("underwriting_applications")
        .select("id, application_number, taxpayer_name, review_status, loan_amount, aggregate_risk_score, is_priority, updated_at, property_address")
        .order("updated_at", { ascending: false }),
      supabase.from("compliance_alerts").select("application_id, severity, resolved").eq("resolved", false),
      supabase.from("rate_holds").select("application_id, expiry_date"),
      supabase.from("renewals").select("id, client_name, maturity_date, renewal_status"),
      supabase.from("audit_logs").select("id, action, entity_type, application_id, created_at, details").order("created_at", { ascending: false }).limit(10),
    ]);
    if (a.data) setApps(a.data as AppRow[]);
    if (al.data) setAlerts(al.data as AlertRow[]);
    if (rh.data) setRateHolds(rh.data as RateHoldRow[]);
    if (rn.data) setRenewals(rn.data as RenewalRow[]);
    if (au.data) setAudit(au.data as AuditRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void fetchAll();
  }, []);

  const stats = useMemo(() => {
    const active = apps.filter((a) => ACTIVE_STATUSES.has(a.review_status));
    const totalValue = active.reduce((s, a) => s + (Number(a.loan_amount) || 0), 0);
    const criticalIds = new Set(
      alerts.filter((x) => (x.severity ?? "").toUpperCase() === "CRITICAL" || (x.severity ?? "").toUpperCase() === "HIGH").map((x) => x.application_id),
    );
    const needAttention = active.filter((a) => criticalIds.has(a.id)).length;

    const now = Date.now();
    const in7 = now + 7 * 864e5;
    const in30 = now + 30 * 864e5;
    const expiringHolds = rateHolds.filter((h) => {
      const t = new Date(h.expiry_date).getTime();
      return t >= now && t <= in7;
    }).length;
    const upcomingRenewals = renewals.filter((r) => {
      if (!r.maturity_date) return false;
      const t = new Date(r.maturity_date).getTime();
      return t >= now && t <= in30;
    }).length;

    return {
      activeCount: active.length,
      totalValue,
      needAttention,
      expiringHolds,
      upcomingRenewals,
    };
  }, [apps, alerts, rateHolds, renewals]);

  const highRiskCount = apps.filter((a) => (a.aggregate_risk_score ?? 0) >= 50).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OnboardingWizard />
      <AppHeader />
      <NewApplicationModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={(id) => {
          void fetchAll();
          navigate({ to: "/", search: { app: id } as never });
        }}
      />

      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-end justify-between gap-4 px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Broker Dashboard</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Deal Summary</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything happening in your book right now.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModal(true)}
              className="inline-flex items-center gap-1.5 rounded-sm bg-chart-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-black"
            >
              <Plus className="h-3.5 w-3.5" /> New Application
            </button>
            <Link
              to="/renewals"
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted"
            >
              View Renewals
            </Link>
            <Link
              to="/pipeline"
              search={{ risk: "high" } as never}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted"
            >
              High-Risk Files ({highRiskCount})
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] space-y-6 px-6 py-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <MetricCard label="Active Files" value={stats.activeCount} icon={FileText} tone="text-chart-2" />
          <MetricCard label="Pipeline Value" value={`$${(stats.totalValue / 1000).toFixed(0)}K`} icon={DollarSign} tone="text-success" />
          <MetricCard label="Needs Attention" value={stats.needAttention} icon={AlertTriangle} tone="text-destructive" />
          <MetricCard label="Rate Holds ≤ 7 days" value={stats.expiringHolds} icon={Zap} tone="text-warning-fg" />
          <MetricCard label="Renewals ≤ 30 days" value={stats.upcomingRenewals} icon={Calendar} tone="text-chart-4" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-sm border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Priority & Recent Files</h2>
              <Link to="/pipeline" className="text-[10.5px] uppercase tracking-wider text-chart-2 hover:underline">
                View pipeline →
              </Link>
            </header>
            <ul className="divide-y divide-border">
              {loading ? (
                <li className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</li>
              ) : apps.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-muted-foreground">No files yet. Create your first application.</li>
              ) : (
                apps
                  .slice()
                  .sort((a, b) => Number(b.is_priority) - Number(a.is_priority))
                  .slice(0, 8)
                  .map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {a.is_priority && <span className="text-chart-4">★</span>}
                          <span className="truncate">{a.taxpayer_name}</span>
                          <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {a.review_status}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                          {a.application_number} · {a.property_address ?? "Address not set"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm tabular-nums">${(Number(a.loan_amount) || 0).toLocaleString()}</div>
                        <div className="text-[10.5px] text-muted-foreground">Risk {a.aggregate_risk_score}</div>
                      </div>
                    </li>
                  ))
              )}
            </ul>
          </section>

          <section className="rounded-sm border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Recent Activity</h2>
            </header>
            <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
              {audit.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-muted-foreground">No activity yet.</li>
              ) : (
                audit.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-chart-2" />
                      <span className="font-semibold">{r.action}</span>
                      <span>·</span>
                      <span className="font-mono">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/80">
                      {r.entity_type ?? "record"}
                      {r.application_id ? ` · ${r.application_id.slice(0, 8)}` : ""}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className={`mb-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] ${tone}`}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="font-mono text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
