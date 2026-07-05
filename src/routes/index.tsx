import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/supabase/client";
import { TaxSlipSuite, TAX_SLIP_TABS, type TaxSlipTab } from "@/components/TaxSlipSuite";
import { LoanTermsPanel } from "@/components/LoanTermsPanel";
import { ReoMatrix } from "@/components/ReoMatrix";
import { useDerivedFinancials, useApplicationStore } from "@/store/applicationStore";
import { LenderManagement } from "@/components/LenderManagement";
import { FlaskConical, Database } from "lucide-react";
import { toast } from "sonner";
import type { VarianceFlag } from "@/utils/taxSlipParser";
import { ComplianceIntakePanel } from "@/components/ComplianceIntakePanel";
import { ComplianceAlertBanner } from "@/components/ComplianceAlertBanner";
import type { ComplianceVerdict } from "@/utils/documentRegistry";
import { RatioBreakdownPopover } from "@/components/RatioBreakdownPopover";
import { ComplianceHealthSidebar } from "@/components/ComplianceHealthSidebar";
import { DossierGate } from "@/components/DossierGate";
import { AmlPanel } from "@/components/AmlPanel";
import { SourceOfFundsPanel } from "@/components/SourceOfFundsPanel";
import { StressTestPanel } from "@/components/StressTestPanel";
import { CmhcPanel } from "@/components/CmhcPanel";
import { RentalOffsetPanel } from "@/components/RentalOffsetPanel";
import { CreditProfilePanel } from "@/components/CreditProfilePanel";
import { IncomeAdjustmentsPanel } from "@/components/IncomeAdjustmentsPanel";
import { RateHoldPanel } from "@/components/RateHoldPanel";
import { ConditionsBoard } from "@/components/ConditionsBoard";
import { SubjectPropertyPanel } from "@/components/SubjectPropertyPanel";
import { PrepaymentPrivilegesPanel } from "@/components/PrepaymentPrivilegesPanel";
import { CoApplicantPanel } from "@/components/CoApplicantPanel";
import { LenderSuitabilityPanel } from "@/components/LenderSuitabilityPanel";
import { LenderGuidelineLibrary } from "@/components/LenderGuidelineLibrary";
import { ExitStrategyPanel } from "@/components/ExitStrategyPanel";
import { CommunicationsPanel } from "@/components/CommunicationsPanel";
import { FileNotesPanel } from "@/components/FileNotesPanel";


interface ApplicationRecord {
  id: string;
  application_number: string;
  taxpayer_name: string;
  aggregate_risk_score: number;
  line_15000_total_income: number;
  created_at: string;
  employment_type?: string | null;
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
  component: () => (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  ),
  validateSearch: (s: Record<string, unknown>) => ({
    app: typeof s.app === "string" ? s.app : undefined,
  }),
});

function Dashboard() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("risk-desc");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");
  const [variancePenalty, setVariancePenalty] = useState(0);
  const [varianceFlags, setVarianceFlags] = useState<VarianceFlag[]>([]);
  const [activeTab, setActiveTab] = useState<TaxSlipTab>("T1");
  const [activeApplicantId, setActiveApplicantId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const [sandboxMode, setSandboxMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [complianceVerdict, setComplianceVerdict] = useState<ComplianceVerdict | null>(null);
  const derived = useDerivedFinancials();
  const resetLoan = useApplicationStore((s) => s.resetLoan);
  const handleVariance = useCallback((penalty: number, flags: VarianceFlag[]) => {
    setVariancePenalty(penalty);
    setVarianceFlags(flags);
  }, []);






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
    const current = applications.find((a) => a.id === activeApplicantId);
    const existingName = current?.taxpayer_name?.trim();
    const draft = nameDraft.trim();
    const name =
      draft ||
      (existingName && existingName.toLowerCase() !== "unnamed applicant" ? existingName : "");

    if (!name) {
      toast.error("Enter the applicant's full name before saving");
      return;
    }

    const payload = {
      ...(current?.id ? { id: current.id } : {}),
      application_number: current?.application_number ?? `APP-${Date.now()}`,
      taxpayer_name: name,
      aggregate_risk_score: (current?.aggregate_risk_score ?? 0) + variancePenalty,
      line_15000_total_income: current?.line_15000_total_income ?? 0,
      tax_year: new Date().getFullYear(),
      gds: derived.ds.gds,
      tds: derived.ds.tds,
    };

    const { error } = await supabase
      .from("underwriting_applications")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("Save failed:", error);
      toast.error("Save failed", { description: error.message });
      return;
    }
    setApplications([]);
    const fresh = await fetchApplications();
    if (!current && fresh) {
      const created = fresh.find((a) => a.application_number === payload.application_number);
      if (created) setActiveApplicantId(created.id);
    }
    setNameDraft("");
    toast.success("Saved to underwriting log", { description: payload.taxpayer_name });
  }, [activeApplicantId, applications, nameDraft, variancePenalty, derived.ds.gds, derived.ds.tds, fetchApplications]);



  const handleCommit = useCallback(async () => {
    await handleSave();
    setPendingChanges(0);
    setSandboxMode(false);
  }, [handleSave]);

  const handleDelete = useCallback(async () => {
    if (!activeApplicantId) {
      console.error("Delete attempted with no selected applicant");
      toast.error("Select an applicant before deleting");
      return;
    }
    const selectedId = activeApplicantId;
    const { error } = await supabase
      .from("underwriting_applications")
      .delete()
      .eq("id", selectedId);

    if (error) {
      console.error("Delete failed:", error);
      toast.error("Delete failed", { description: error.message });
      return;
    }
    setActiveApplicantId(null);
    setApplications([]);
    resetLoan();
    setVariancePenalty(0);
    setVarianceFlags([]);
    await fetchApplications();
    toast.success("Applicant deleted");
  }, [activeApplicantId, fetchApplications, resetLoan]);



  const { app: appParam } = Route.useSearch();
  useEffect(() => {
    if (appParam && appParam !== activeApplicantId) {
      setActiveApplicantId(appParam);
    }
  }, [appParam, activeApplicantId]);

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

  const loanState = useApplicationStore((s) => s.loan);
  const employmentComplete =
    derived.householdIncome > 0 && loanState.propertyPrice > 0 && loanState.amortizationYears > 0;

  if (loading) return <div className="p-20 text-center">Loading from Database...</div>;
  if (error) return <div className="p-20 text-center text-destructive">Error: {error}</div>;



  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="flex gap-4 p-6">
        <div className="min-w-0 flex-1">


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
              className="rounded-sm bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
            >
              Commit to Underwriting Log
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder={activeApplicant?.taxpayer_name ?? "Applicant full name"}
            className="rounded-sm border border-input bg-card px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            style={{ minWidth: 200 }}
          />
          <button
            type="button"
            onClick={handleSave}
            className="rounded-sm border border-primary bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-sm border border-destructive bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>


      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-6">
        <RatioBreakdownPopover
          title="Mortgage Qualifying Rate (Stress Test)"
          formula="MQR = MAX(contract rate + 2.00%, 5.25%) · OSFI B-20"
          accent="magenta"
          rows={[
            { label: "Contract rate", value: `${loanState.interestRatePct.toFixed(2)}%` },
            { label: "MQR floor", value: "5.25%" },
            { label: "Qualifying rate", value: `${derived.stress.qualifyingRatePct.toFixed(2)}%`, emphasis: true },
            { label: "Stressed monthly P+I", value: `$${derived.stress.monthlyPI.toFixed(2)}` },
            { label: "Stressed GDS", value: `${derived.stress.gds.toFixed(2)}% / cap ${derived.stress.gdsCap}%` },
            { label: "Stressed TDS", value: `${derived.stress.tds.toFixed(2)}% / cap ${derived.stress.tdsCap}%` },
            { label: derived.stress.pass ? "STRESS TEST PASS" : "STRESS TEST FAIL", value: derived.stress.stream, emphasis: true },
          ]}
          result={`${derived.stress.qualifyingRatePct.toFixed(2)}%`}
        >
          <GlobalRatio
            label={`MQR ${derived.stress.pass ? "PASS" : "FAIL"}`}
            value={`${derived.stress.qualifyingRatePct.toFixed(2)}%`}
            warn={derived.stress.requiresStressTest && !derived.stress.pass}
          />
        </RatioBreakdownPopover>
        <RatioBreakdownPopover
          title="Loan-to-Value"
          formula="LTV = Loan Amount ÷ Property Price × 100"
          accent="cyan"
          rows={[
            { label: "Property Price", value: `$${loanState.propertyPrice.toLocaleString()}` },
            { label: "Down Payment", value: `$${loanState.downPayment.toLocaleString()}` },
            { label: "Loan Amount", value: `$${Math.max(0, loanState.propertyPrice - loanState.downPayment).toLocaleString()}`, emphasis: true },
            { label: "Conventional threshold", value: "≤ 65%" },
            { label: "Insured threshold", value: "> 80% (CMHC)" },
            { label: "Current LTV", value: `${derived.ltv.toFixed(2)}%`, emphasis: true },
          ]}
          result={`${derived.ltv.toFixed(2)}%`}
        >
          <GlobalRatio label="LTV" value={`${derived.ltv.toFixed(2)}%`} warn={derived.ltv > 80} />
        </RatioBreakdownPopover>
        <RatioBreakdownPopover
          title="Gross Debt Service"
          formula="GDS = (P+I + Property Tax/12 + Heating + ½ Condo) ÷ Gross Monthly Income × 100"
          accent="magenta"
          rows={[
            { label: "Monthly P+I", value: `$${derived.monthlyPI.toFixed(2)}` },
            { label: "Property Tax / 12", value: `$${(loanState.annualPropertyTaxes / 12).toFixed(2)}` },
            { label: "Heating (monthly)", value: `$${loanState.monthlyHeating.toFixed(2)}` },
            { label: "½ Condo / Strata", value: `$${(loanState.monthlyCondoFees * 0.5).toFixed(2)}` },
            { label: "Gross Monthly Income", value: `$${(derived.householdIncome / 12).toFixed(2)}` },
            { label: `Stress GDS @ ${derived.stress.qualifyingRatePct.toFixed(2)}%`, value: `${derived.stress.gds.toFixed(2)}% ${derived.stress.pass ? "· PASS" : "· FAIL"}` },
            { label: "GDS Ratio", value: `${derived.ds.gds.toFixed(2)}%`, emphasis: true },
          ]}
          result={`${derived.ds.gds.toFixed(2)}%`}
        >
          <GlobalRatio label="GDS" value={`${derived.ds.gds.toFixed(2)}%`} warn={derived.ds.gdsExceeded} />
        </RatioBreakdownPopover>
        <RatioBreakdownPopover
          title="Total Debt Service"
          formula="TDS = (GDS Costs + All Other Monthly Debt) ÷ Gross Monthly Income × 100"
          accent="magenta"
          rows={[
            { label: "GDS costs (monthly)", value: `$${(derived.monthlyPI + loanState.annualPropertyTaxes / 12 + loanState.monthlyHeating + loanState.monthlyCondoFees * 0.5).toFixed(2)}` },
            { label: "Other monthly debt", value: `$${derived.liabilities.otherMonthlyDebt.toFixed(2)}` },
            { label: "Gross Monthly Income", value: `$${(derived.householdIncome / 12).toFixed(2)}` },
            { label: `Stress TDS @ ${derived.stress.qualifyingRatePct.toFixed(2)}%`, value: `${derived.stress.tds.toFixed(2)}% ${derived.stress.pass ? "· PASS" : "· FAIL"}` },
            { label: "TDS Ratio", value: `${derived.ds.tds.toFixed(2)}%`, emphasis: true },
          ]}
          result={`${derived.ds.tds.toFixed(2)}%`}
        >
          <GlobalRatio label="TDS" value={`${derived.ds.tds.toFixed(2)}%`} warn={derived.ds.tdsExceeded} />
        </RatioBreakdownPopover>
        <RatioBreakdownPopover
          title="Monthly Principal + Interest"
          formula="P+I = P × r / (1 − (1+r)^-n) · r = semi-annual → monthly"
          accent="cyan"
          rows={[
            { label: "Financed amount", value: `$${derived.loanAmount.toLocaleString()}` },
            { label: "Contract rate", value: `${loanState.interestRatePct.toFixed(2)}%` },
            { label: "Amortization", value: `${loanState.amortizationYears} yrs` },
            { label: "Contract P+I", value: `$${derived.monthlyPI.toFixed(2)}`, emphasis: true },
            { label: "Stressed P+I", value: `$${derived.stress.monthlyPI.toFixed(2)}` },
          ]}
          result={derived.monthlyPI.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
        >
          <GlobalRatio
            label="Monthly P+I"
            value={derived.monthlyPI.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
          />
        </RatioBreakdownPopover>
        <RatioBreakdownPopover
          title="Household Qualifying Income"
          formula="Household = Primary + Co-Applicant + Rental Contribution (± adjustments)"
          accent="cyan"
          rows={[
            { label: "Primary", value: `$${loanState.primaryAnnualIncome.toLocaleString()}` },
            { label: "Co-Applicant", value: loanState.coApplicantEnabled ? `$${loanState.coAnnualIncome.toLocaleString()}` : "—" },
            { label: "Rental contribution", value: `$${derived.rentalContribution.toLocaleString()}` },
            { label: "Household Income", value: `$${derived.householdIncome.toLocaleString()}`, emphasis: true },
          ]}
          result={derived.householdIncome.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
        >
          <GlobalRatio
            label="Household Income"
            value={derived.householdIncome.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
          />
        </RatioBreakdownPopover>
      </div>



      <header className="mb-8 border-b border-border pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Underwriting Workspace
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Document Registry, Forensic Lens, Scoring Matrix & Conditions
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <Stat label="Applications" value={stats.total} />
            <Stat label="High Risk" value={stats.highRisk} tone="destructive" />
            <Stat label="Elevated" value={stats.elevated} tone="warning" />
            <Stat label="Avg Score" value={stats.average} />
          </div>
        </div>

        <div className="mt-5 text-xs text-muted-foreground">
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

      </header>

      {complianceVerdict && complianceVerdict.alerts.length > 0 && (
        <ComplianceAlertBanner
          verdict={complianceVerdict}
          applicantName={activeApplicant?.taxpayer_name}
        />
      )}

      <div className="mb-6">
        <ComplianceIntakePanel
          applicantId={activeApplicantId}
          onVerdictChange={setComplianceVerdict}
          onApplicantNameChange={(n) => setNameDraft(n)}
        />
      </div>


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
        <div id="loan-terms" className="scroll-mt-24"><LoanTermsPanel /></div>
      </div>

      <div className="mt-6 space-y-4">
        <SubjectPropertyPanel />
        <CoApplicantPanel />
        <StressTestPanel />
        <CmhcPanel />
        <RentalOffsetPanel />
        <CreditProfilePanel />
        <IncomeAdjustmentsPanel applicantId={activeApplicantId} />
        <PrepaymentPrivilegesPanel />
      </div>



      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              REO Matrix · Portfolio Grid
            </h2>
          </div>
          <ReoMatrix
            onStreamChange={() => {
              if (sandboxMode) setPendingChanges((c) => c + 1);
            }}
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

      <div className="mt-6 space-y-4">
        <LenderSuitabilityPanel
          applicationId={activeApplicantId}
          employmentType={
            (activeApplicant?.employment_type as "Salaried" | "Self-Employed" | "Incorporated" | undefined) ?? null
          }
        />
        <LenderGuidelineLibrary
          employmentType={
            (activeApplicant?.employment_type as "Salaried" | "Self-Employed" | "Incorporated" | undefined) ?? null
          }
          yearsSelfEmployed={null}
        />
        <ExitStrategyPanel />
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
          showInternalTabs
        />

      </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <AmlPanel />
            <SourceOfFundsPanel />
          </div>

          <div className="mt-6 space-y-4">
            <RateHoldPanel
              applicationId={activeApplicantId}
              lenderName={activeApplicant?.taxpayer_name}
            />
            <ConditionsBoard applicationId={activeApplicantId} />
          </div>

          <div className="mt-6">
            <CommunicationsPanel
              applicantId={activeApplicantId}
              applicantName={nameDraft || activeApplicant?.taxpayer_name || null}
            />
          </div>

          <div className="mt-6">
            <FileNotesPanel applicationId={activeApplicantId} />
          </div>


          <DossierGate
            verdict={complianceVerdict}
            employmentComplete={employmentComplete}
            employmentType={activeApplicant?.employment_type ?? null}
            applicantName={nameDraft || activeApplicant?.taxpayer_name || ""}
            applicationNumber={activeApplicant?.application_number}
            applicantId={activeApplicantId}
          />


        </div>
        <aside className="hidden w-[300px] shrink-0 xl:block">
          <ComplianceHealthSidebar
            verdict={complianceVerdict}
            employmentComplete={employmentComplete}
            applicantId={activeApplicantId}
          />
        </aside>

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

function GlobalRatio({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-4 py-3 ${warn ? "bg-warning-bg" : "bg-card"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-lg font-bold tracking-tight ${warn ? "text-warning-fg" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
