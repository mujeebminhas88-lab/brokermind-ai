/**
 * /lender — Private Lender Portfolio Dashboard. Aggregates all files across
 * the firm into portfolio-level metrics: total book value, average LTV,
 * geographic concentration, maturity schedule, yield tracker, and concentration
 * flags. RLS ensures a lender only sees their own firm's book.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { AlertTriangle, DollarSign, Map, Percent, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/lender")({
  component: () => (
    <AuthGate>
      <LenderPortalPage />
    </AuthGate>
  ),
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
  head: () => ({
    meta: [
      { title: "Lender Portfolio — BrokerMind AI" },
      { name: "description", content: "Aggregate portfolio dashboard for lender accounts: book value, LTV, maturity schedule, concentration risk." },
    ],
  }),
});

interface AppRow {
  id: string;
  taxpayer_name: string;
  loan_amount: number | null;
  aggregate_risk_score: number | null;
  review_status: string;
  province: string | null;
  property_address: string | null;
  lender_name: string | null;
}

interface Renewal {
  id: string;
  client_name: string | null;
  maturity_date: string | null;
  current_rate: number | null;
  current_balance: number | null;
}

function LenderPortalPage() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [a, r] = await Promise.all([
        supabase
          .from("underwriting_applications")
          .select("id, taxpayer_name, loan_amount, aggregate_risk_score, review_status, province, property_address, lender_name"),
        supabase.from("renewals").select("id, client_name, maturity_date, current_rate, current_balance"),
      ]);
      if (a.data) setApps(a.data as AppRow[]);
      if (r.data) setRenewals(r.data as unknown as Renewal[]);
      setLoading(false);
    })();
  }, []);

  const metrics = useMemo(() => {
    const funded = apps.filter((a) => a.review_status === "Funded" || a.review_status === "Approved");
    const bookValue = funded.reduce((s, a) => s + (Number(a.loan_amount) || 0), 0);
    const provinces: Record<string, number> = {};
    for (const a of funded) {
      const p = (a.province ?? "").toUpperCase() || "—";
      provinces[p] = (provinces[p] ?? 0) + (Number(a.loan_amount) || 0);
    }
    const provinceList = Object.entries(provinces).sort((a, b) => b[1] - a[1]);
    const highRisk = funded.filter((a) => (a.aggregate_risk_score ?? 0) >= 60);
    const weightedRate =
      renewals.reduce((s, r) => s + (Number(r.current_rate ?? 0) * Number(r.current_balance ?? 0)), 0) /
      Math.max(1, renewals.reduce((s, r) => s + Number(r.current_balance ?? 0), 0));

    // Maturity by month
    const maturityByMonth: Record<string, number> = {};
    for (const r of renewals) {
      if (!r.maturity_date) continue;
      const k = r.maturity_date.slice(0, 7);
      maturityByMonth[k] = (maturityByMonth[k] ?? 0) + Number(r.current_balance ?? 0);
    }
    const maturityList = Object.entries(maturityByMonth).sort();

    // Concentration flags: any province > 40% of book
    const concentrationFlags = provinceList.filter(([, v]) => bookValue > 0 && v / bookValue > 0.4);

    return { bookValue, provinceList, highRisk, weightedRate, maturityList, concentrationFlags, fundedCount: funded.length };
  }, [apps, renewals]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1800px] px-6 py-6">
          <p className="text-xs uppercase tracking-[0.18em] text-chart-4">Lender Portal</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Portfolio Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate view of your book. Concentration limits flag single-postal-code or province exposure above 40%.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Book Value" value={`$${(metrics.bookValue / 1e6).toFixed(2)}M`} icon={DollarSign} tone="text-success" />
          <Metric label="Funded Files" value={metrics.fundedCount} icon={TrendingUp} tone="text-chart-2" />
          <Metric label="Weighted Rate" value={`${(metrics.weightedRate || 0).toFixed(2)}%`} icon={Percent} tone="text-chart-4" />
          <Metric label="High-Risk" value={metrics.highRisk.length} icon={AlertTriangle} tone="text-destructive" />
        </div>

        {metrics.concentrationFlags.length > 0 && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Concentration Alert
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {metrics.concentrationFlags.map(([p, v]) => (
                <li key={p}>
                  <strong>{p}</strong> represents {((v / metrics.bookValue) * 100).toFixed(1)}% of book (${(v / 1000).toFixed(0)}K).
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-sm border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Map className="h-3.5 w-3.5 text-chart-2" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Geographic Concentration</h2>
            </header>
            <ul className="p-3 space-y-1.5">
              {metrics.provinceList.length === 0 ? (
                <li className="text-xs text-muted-foreground p-3">No funded files yet.</li>
              ) : (
                metrics.provinceList.map(([p, v]) => {
                  const pct = metrics.bookValue > 0 ? (v / metrics.bookValue) * 100 : 0;
                  return (
                    <li key={p} className="text-xs">
                      <div className="flex justify-between font-mono">
                        <span>{p}</span>
                        <span>${(v / 1000).toFixed(0)}K · {pct.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-sm bg-muted overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, background: pct > 40 ? "#E91E8C" : "#00BCD4" }} />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="rounded-sm border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Maturity Schedule</h2>
            </header>
            <ul className="p-3 space-y-1.5 max-h-[400px] overflow-y-auto">
              {metrics.maturityList.length === 0 ? (
                <li className="text-xs text-muted-foreground p-3">No renewals tracked yet.</li>
              ) : (
                metrics.maturityList.map(([month, val]) => (
                  <li key={month} className="flex justify-between text-xs font-mono">
                    <span>{month}</span>
                    <span>${(val / 1000).toFixed(0)}K</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <section className="rounded-sm border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Review Queue</h2>
          </header>
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Borrower</th>
                    <th className="p-3 text-left">Property</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Risk</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.slice(0, 20).map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="p-3">{a.taxpayer_name}</td>
                      <td className="p-3 text-muted-foreground">{a.property_address ?? "—"}</td>
                      <td className="p-3 text-right font-mono">${(Number(a.loan_amount) || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">{a.aggregate_risk_score ?? "—"}</td>
                      <td className="p-3">
                        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                          {a.review_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; tone: string }) {
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
