import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/supabase/client";
import { TaxSlipSuite, TAX_SLIP_TABS, type TaxSlipTab } from "@/components/TaxSlipSuite";
import { LoanTermsPanel, DEFAULT_LOAN_TERMS, type LoanTerms } from "@/components/LoanTermsPanel";
import { ReoMatrix, type LenderStream } from "@/components/ReoMatrix";
import { LenderManagement } from "@/components/LenderManagement";
import { FlaskConical, Database } from "lucide-react";
import { toast } from "sonner";
import type { VarianceFlag } from "@/utils/taxSlipParser";

interface ApplicationRecord {
  id: string;
  application_number: string;
  taxpayer_name: string;
  aggregate_risk_score: number;
  line_15000_total_income: number;
  created_at: string;
}

type SortKey = "risk-desc" | "risk-asc" | "name" | "app" | "income-desc";
type GroupKey = "none" | "tier";

interface RiskTier {
  label: string;
  description: string;
  color: string;
  border: string;
  bg: string;
  bar: string;
}

function getRiskTier(score: number): RiskTier {
  if (score < 30) {
    return {
      label: "LOW RISK",
      description: "Well within OSFI B-20 serviceability thresholds.",
      color: "text-success",
      border: "border-success/40",
      bg: "bg-success/8",
      bar: "bg-success",
    };
  }
  if (score < 50) {
    return {
      label: "MODERATE RISK",
      description: "Eligible with standard conditions and documentation.",
      color: "text-warning-fg",
      border: "border-warning/40",
      bg: "bg-warning-bg",
      bar: "bg-warning",
    };
  }
  if (score < 75) {
    return {
      label: "ELEVATED RISK",
      description: "Enhanced due diligence and manual review required.",
      color: "text-chart-4",
      border: "border-chart-4/40",
      bg: "bg-chart-4/10",
      bar: "bg-chart-4",
    };
  }
  return {
    label: "HIGH RISK",
    description: "Material exceptions present; adjudicator discretion needed.",
    color: "text-destructive",
    border: "border-destructive/40",
    bg: "bg-destructive/10",
    bar: "bg-destructive",
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("risk-desc");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");
  const [variancePenalty, setVariancePenalty] = useState(0);
  const [varianceFlags, setVarianceFlags] = useState<VarianceFlag[]>([]);
  const [loanTerms, setLoanTerms] = useState<LoanTerms>(DEFAULT_LOAN_TERMS);
  const [activeTab, setActiveTab] = useState<TaxSlipTab>("T1");
  const [activeApplicantId, setActiveApplicantId] = useState<string | null>(null);
  const [lenderStream, setLenderStream] = useState<LenderStream>("A");
  const [sandboxMode, setSandboxMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const handleVariance = useCallback((penalty: number, flags: VarianceFlag[]) => {
    setVariancePenalty(penalty);
    setVarianceFlags(flags);
  }, []);

  const handleLoanTermsChange: typeof setLoanTerms = useCallback((next) => {
    setLoanTerms((prev) => {
      const resolved = typeof next === "function" ? (next as (p: LoanTerms) => LoanTerms)(prev) : next;
      if (sandboxMode) setPendingChanges((c) => c + 1);
      return resolved;
    });
  }, [sandboxMode]);

  const handleCommit = useCallback(() => {
    toast.success("Sandbox committed to underwriting log", {
      description: `${pendingChanges} change${pendingChanges === 1 ? "" : "s"} persisted. Aggregate risk re-baselined.`,
    });
    setPendingChanges(0);
    setSandboxMode(false);
  }, [pendingChanges]);

  const handleSandboxToggle = useCallback(() => {
    if (sandboxMode && pendingChanges > 0) {
      toast.info("Sandbox discarded", { description: `${pendingChanges} uncommitted change${pendingChanges === 1 ? "" : "s"} reverted.` });
    }
    setSandboxMode((m) => !m);
    setPendingChanges(0);
  }, [sandboxMode, pendingChanges]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("underwriting_applications")
      .select(
        "id, application_number, taxpayer_name, aggregate_risk_score, line_15000_total_income, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase Error:", error);
      setError(error.message);
      setLoading(false);
      return;
    }

    const seen = new Set<string>();
    const deduped: ApplicationRecord[] = [];
    for (const row of (data ?? []) as unknown as ApplicationRecord[]) {
      if (!row?.application_number || seen.has(row.application_number)) continue;
      seen.add(row.application_number);
      deduped.push(row);
    }
    setApplications(deduped);
    setLoading(false);
    return deduped;
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleSave = useCallback(async () => {
    if (!activeApplicantId) {
      toast.error("No active applicant to save");
      return;
    }
    const current = applications.find((a) => a.id === activeApplicantId);
    if (!current) return;

    const payload = {
      id: current.id,
      application_number: current.application_number,
      taxpayer_name: current.taxpayer_name,
      aggregate_risk_score: current.aggregate_risk_score + variancePenalty,
      line_15000_total_income: current.line_15000_total_income,
      tax_year: new Date().getFullYear(),
      gds: 0,
      tds: 0,
    };

    const { error } = await supabase
      .from("underwriting_applications")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    // Clear local cache + force re-fetch
    setApplications([]);
    await fetchApplications();
    toast.success("Saved to underwriting log");
  }, [activeApplicantId, applications, variancePenalty, fetchApplications]);

  const handleDelete = useCallback(async () => {
    if (!activeApplicantId) return;
    const target = activeApplicantId;
    const { error } = await supabase
      .from("underwriting_applications")
      .delete()
      .eq("id", target);

    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    // Clear local state, deselect, redirect to list
    setActiveApplicantId(null);
    setApplications([]);
    setLoanTerms(DEFAULT_LOAN_TERMS);
    setVariancePenalty(0);
    setVarianceFlags([]);
    await fetchApplications();
    toast.success("Applicant deleted");
  }, [activeApplicantId, fetchApplications]);


  useEffect(() => {
    if (!activeApplicantId && applications.length > 0) {
      setActiveApplicantId(applications[0].id);
    }
  }, [applications, activeApplicantId]);

  const activeApplicant = useMemo(
    () => applications.find((a) => a.id === activeApplicantId) ?? null,
    [applications, activeApplicantId],
  );

  const sortedApplications = useMemo(() => {
    const list = [...applications];
    switch (sortBy) {
      case "risk-desc":
        list.sort((a, b) => b.aggregate_risk_score - a.aggregate_risk_score);
        break;
      case "risk-asc":
        list.sort((a, b) => a.aggregate_risk_score - b.aggregate_risk_score);
        break;
      case "name":
        list.sort((a, b) => a.taxpayer_name.localeCompare(b.taxpayer_name));
        break;
      case "app":
        list.sort((a, b) => a.application_number.localeCompare(b.application_number));
        break;
      case "income-desc":
        list.sort((a, b) => b.line_15000_total_income - a.line_15000_total_income);
        break;
    }
    return list;
  }, [applications, sortBy]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return { Ungrouped: sortedApplications };
    const buckets: Record<string, ApplicationRecord[]> = {
      "HIGH RISK": [],
      "ELEVATED RISK": [],
      "MODERATE RISK": [],
      "LOW RISK": [],
    };
    for (const app of sortedApplications) {
      const tier = getRiskTier(app.aggregate_risk_score);
      buckets[tier.label].push(app);
    }
    return Object.fromEntries(
      Object.entries(buckets).filter(([, items]) => items.length > 0)
    );
  }, [sortedApplications, groupBy]);

  const stats = useMemo(() => {
    const total = applications.length;
    const highRisk = applications.filter((a) => a.aggregate_risk_score >= 75).length;
    const elevated = applications.filter((a) => a.aggregate_risk_score >= 50 && a.aggregate_risk_score < 75).length;
    const average = total > 0 ? Math.round(applications.reduce((sum, a) => sum + a.aggregate_risk_score, 0) / total) : 0;
    return { total, highRisk, elevated, average };
  }, [applications]);

  if (loading) return <div className="p-20 text-center">Loading from Database...</div>;
  if (error) return <div className="p-20 text-center text-destructive">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div
        className={`mb-4 flex items-center justify-between gap-4 rounded-sm border px-4 py-2.5 ${
          sandboxMode ? "border-warning/50 bg-warning-bg" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSandboxToggle}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              sandboxMode ? "bg-warning" : "bg-muted"
            }`}
            aria-pressed={sandboxMode}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                sandboxMode ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <div className="flex items-center gap-2">
            {sandboxMode ? <FlaskConical className="h-4 w-4 text-warning-fg" /> : <Database className="h-4 w-4 text-muted-foreground" />}
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              {sandboxMode ? "Sandbox Mode · Changes are not persisted" : "Live Mode · Edits write through"}
            </span>
          </div>
        </div>
        {sandboxMode && (
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-warning-fg">
              {pendingChanges} pending edit{pendingChanges === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={handleCommit}
              disabled={pendingChanges === 0}
              className="rounded-sm bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-40 hover:opacity-90"
            >
              Commit to Underwriting Log
            </button>
          </div>
        )}
      </div>

      <header className="mb-8 border-b border-border pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              BrokerMind AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Underwriter Workspace — Pipeline Ledger & Risk Prioritization
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <Stat label="Applications" value={stats.total} />
            <Stat label="High Risk" value={stats.highRisk} tone="destructive" />
            <Stat label="Elevated" value={stats.elevated} tone="warning" />
            <Stat label="Avg Score" value={stats.average} />
          </div>
        </div>
        <nav
          className="mt-5 flex items-center justify-between gap-4"
          aria-label="Tax slip sections"
        >
          <div className="flex items-center gap-px rounded-sm border border-border bg-border overflow-hidden">
            {TAX_SLIP_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  activeTab === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-pressed={activeTab === t}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            {activeApplicant ? (
              <>
                Active applicant ·{" "}
                <span className="font-mono text-foreground">
                  {activeApplicant.application_number}
                </span>{" "}
                <span className="text-foreground">— {activeApplicant.taxpayer_name}</span>
              </>
            ) : (
              "No applicant selected"
            )}
          </div>
        </nav>
      </header>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="sort" className="text-sm font-medium text-muted-foreground">
            Sort by
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-sm border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="risk-desc">Risk Score (High → Low)</option>
            <option value="risk-asc">Risk Score (Low → High)</option>
            <option value="name">Taxpayer Name</option>
            <option value="app">Application Number</option>
            <option value="income-desc">Total Income</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Group</span>
          <div className="flex rounded-sm border border-input overflow-hidden">
            <button
              onClick={() => setGroupBy("none")}
              className={`px-3 py-1.5 text-sm ${
                groupBy === "none"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-muted"
              }`}
            >
              Flat
            </button>
            <button
              onClick={() => setGroupBy("tier")}
              className={`px-3 py-1.5 text-sm ${
                groupBy === "tier"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-muted"
              }`}
            >
              Risk Tier
            </button>
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <p className="text-muted-foreground">No applications found. Add a record in your database.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group}>
              {groupBy === "tier" && (
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group} ({items.length})
                </h2>
              )}
              <div className="grid gap-4">
                {items.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    active={app.id === activeApplicantId}
                    onSelect={() => setActiveApplicantId(app.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Loan Terms · Amortization · Co-Applicant
          </h2>
        </div>
        <LoanTermsPanel state={loanTerms} setState={handleLoanTermsChange} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              REO Matrix · Portfolio Grid
            </h2>
          </div>
          <ReoMatrix
            lenderStream={lenderStream}
            onStreamChange={(s) => {
              setLenderStream(s);
              if (sandboxMode) setPendingChanges((c) => c + 1);
            }}
            disabled={false}
          />
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Lender Management
            </h2>
          </div>
          <LenderManagement applicationId={activeApplicantId ?? ""} />
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Phase 4 + 5 — Tax Slip Suite (T1 · T4 · T2125 · T4A · T2 Corporate)
          </h2>
          {variancePenalty > 0 && (
            <span className="inline-flex items-center rounded-sm border border-warning/40 bg-warning-bg px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-warning-fg">
              +{variancePenalty} to aggregate risk · {varianceFlags.length} flag{varianceFlags.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <TaxSlipSuite
          onPenaltyChange={handleVariance}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          applicantId={activeApplicantId ?? undefined}
          showInternalTabs={false}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
      ? "text-warning-fg"
      : "text-foreground";
  return (
    <div className="text-right">
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function ApplicationCard({
  app,
  active = false,
  onSelect,
}: {
  app: ApplicationRecord;
  active?: boolean;
  onSelect?: () => void;
}) {
  const tier = getRiskTier(app.aggregate_risk_score);
  const scorePercent = Math.min(100, Math.max(0, app.aggregate_risk_score));

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full overflow-hidden rounded-sm border bg-card text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring ${tier.border} ${
        active ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className={`absolute left-0 top-0 h-full w-1 ${tier.bar}`} />
      <div className="p-5 pl-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-foreground">{app.taxpayer_name}</h2>
              <span
                className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tier.bg} ${tier.color}`}
              >
                {tier.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Application {app.application_number}</p>
            <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>
          </div>

          <div className="flex flex-col gap-1 md:w-56">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Risk Score</span>
              <span className="font-bold text-foreground">{app.aggregate_risk_score}/100</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
              <div
                className={`h-full ${tier.bar}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>

          <div className="md:text-right">
            <div className="text-sm text-muted-foreground">Line 15000 Income</div>
            <div className="text-lg font-semibold text-foreground">
              {formatCurrency(app.line_15000_total_income)}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
