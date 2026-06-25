import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import React from "react";
import {
  FileText,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Search,
  Bell,
  Settings,
  Activity,
  Layers,
  Copy,
  CheckCircle2,
  Clock,
  Building2,
  TrendingDown,
  Receipt,
  Hash,
  User,
  Calendar,
  DollarSign,
  X,
  Sparkles,
  Plus,
  Loader2,
} from "lucide-react";
import { NoaUploader } from "@/components/NoaUploader";
import { SandboxToggleBar, SandboxPanel } from "@/components/SandboxPanel";
import { PipelineLedger, SaveApplicationButton } from "@/components/PipelineLedger";
import { ExportAuditSheetButton } from "@/components/ExportAuditSheet";
import { LiabilitiesPanel, DEFAULT_LIABILITIES, type LiabilityInputs } from "@/components/LiabilitiesPanel";
import { CollateralPanel, DEFAULT_COLLATERAL, computeLtv, type CollateralState } from "@/components/CollateralPanel";
import { EmploymentIntakePanel, DEFAULT_EMPLOYMENT, type EmploymentState } from "@/components/EmploymentIntakePanel";
import { calculateDebtService } from "@/utils/debtService";
import type { NoaAnalysis, RiskFlag } from "@/utils/noaParser";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_APP_NUMBER = "APP-2025-08842";
const DEFAULT_TAXPAYER = "Mujeeb Minhas";
const DEFAULT_QUALIFYING_INCOME = 94500;

type IncomeOverride = { value: string; note: string; appliedAt: string } | null;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrokerMindAI — Underwriter Adjudication Workspace" },
      {
        name: "description",
        content:
          "Executive mortgage adjudication dashboard: forensic document lens, dynamic scoring matrix, and conditions automation.",
      },
      { property: "og:title", content: "BrokerMindAI" },
      {
        property: "og:description",
        content: "Underwriter adjudication workspace for mortgage operations.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [conditions, setConditions] = useState(initialConditions);
  const [incomeOverride, setIncomeOverride] = useState<IncomeOverride>(null);
  const [analysis, setAnalysis] = useState<NoaAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState(DEFAULT_APP_NUMBER);
  const [liabilities, setLiabilities] = useState<LiabilityInputs>(DEFAULT_LIABILITIES);
  const [collateral, setCollateral] = useState<CollateralState>(DEFAULT_COLLATERAL);
  const [employment, setEmployment] = useState<EmploymentState>(DEFAULT_EMPLOYMENT);
  const [collateralFlags, setCollateralFlags] = useState<RiskFlag[]>([]);
  const [employmentFlags, setEmploymentFlags] = useState<RiskFlag[]>([]);

  const qualifyingIncome =
    analysis?.payload.line_15000_total_income ?? DEFAULT_QUALIFYING_INCOME;
  const debtService = calculateDebtService(qualifyingIncome, liabilities);
  const ltvCalc = computeLtv(collateral);

  const extraFlags = [...collateralFlags, ...employmentFlags];
  const extraPenalty = extraFlags.reduce((s, f) => s + f.penalty, 0);

  const craCleared = conditions.find((c) => c.id === "INC-04")?.satisfied ?? false;
  const baseScore = craCleared ? 30 : 45;
  const debtServicePenalty =
    (debtService.gdsExceeded ? 18 : 0) + (debtService.tdsExceeded ? 22 : 0);
  const aggregateRiskScore =
    (analysis ? analysis.aggregatePenalty : baseScore) + debtServicePenalty + extraPenalty;
  const taxpayerName = analysis?.payload.taxpayer_name ?? DEFAULT_TAXPAYER;

  return (
    <div className="min-h-screen bg-background font-display text-foreground antialiased">
      <TopBar />
      <SubHeader applicationNumber={applicationNumber} taxpayerName={taxpayerName} />
      
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <LenderManagement />
        
        <CollateralPanel
          state={collateral}
          setState={setCollateral}
          onFlagsChange={setCollateralFlags}
        />
        
        <div className="flex items-center justify-between border-b border-border bg-card">
          <div className="flex-1">
            <SandboxToggleBar enabled={sandbox} onToggle={(v) => { setSandbox(v); if (!v) setAnalysis(null); }} />
          </div>
          <div className="flex items-center gap-2 border-l border-border px-4 py-2.5">
            <ExportAuditSheetButton
              analysis={analysis}
              applicationNumber={applicationNumber}
              taxpayerName={taxpayerName}
              gds={debtService.gds}
              tds={debtService.tds}
              aggregateRiskScore={aggregateRiskScore}
            />
            <SaveApplicationButton
              analysis={analysis}
              applicationNumber={applicationNumber}
              gds={debtService.gds}
              tds={debtService.tds}
              aggregateRiskScore={aggregateRiskScore}
            />
          </div>
        </div>
        
        {sandbox ? (
          <SandboxPanel onAnalyzed={setAnalysis} onClear={() => setAnalysis(null)} />
        ) : (
          <NoaUploader
            analysis={analysis}
            analyzing={analyzing}
            onAnalyzed={setAnalysis}
            onAnalyzingChange={setAnalyzing}
            onClear={() => setAnalysis(null)}
          />
        )}
        
        <LiabilitiesPanel
          liabilities={liabilities}
          setLiabilities={setLiabilities}
          result={debtService}
        />
        
        <EmploymentIntakePanel
          state={employment}
          setState={setEmployment}
          onFlagsChange={setEmploymentFlags}
        />
        
        <main
          className="grid grid-cols-12 gap-px bg-border"
          style={{ minHeight: "calc(100vh - 168px)" }}
        >
          <section className="col-span-12 lg:col-span-5 bg-background overflow-hidden">
            <DocumentLens incomeOverride={incomeOverride} setIncomeOverride={setIncomeOverride} />
          </section>
          <section className="col-span-12 lg:col-span-4 bg-background overflow-hidden relative">
            <ScoringMatrix
              craCleared={craCleared}
              analysis={analysis}
              debtService={debtService}
              extraFlags={extraFlags}
              ltv={ltvCalc.ltv}
              highRatio={ltvCalc.highRatio}
            />
            {analyzing && <AnalyzingOverlay label="Scoring matrix recalculating" />}
          </section>
          <section className="col-span-12 lg:col-span-3 bg-background overflow-hidden relative">
            <ConditionsPanel
              conditions={conditions}
              setConditions={setConditions}
              incomeOverride={incomeOverride}
              analysis={analysis}
            />
            {analyzing && <AnalyzingOverlay label="Drafting conditions" />}
          </section>
        </main>
        
        <PipelineLedger
          onLoadRecord={({ analysis: a, applicationNumber: appNum }) => {
            setApplicationNumber(appNum);
            setAnalysis(a);
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />
      </div>
    </div>
  );
}

/* ────────────────────────── LENDER MANAGEMENT ────────────────────────── */

const BASELINE_LENDERS = [
  { id: "b2b", name: "B2B Bank", tier: "prime" },
  { id: "bmo", name: "BMO (Authorized Brokers Only)", tier: "prime" },
  { id: "cwb-optimum", name: "CWB Optimum Mortgage A", tier: "prime" },
  { id: "home-classic", name: "Home Trust Company Classic", tier: "prime" },
  { id: "merix", name: "Merix Upfront", tier: "prime" },
  { id: "mcap-prime", name: "MCAP Prime", tier: "prime" },
  { id: "rfa-prime", name: "RFA Prime", tier: "prime" },
  { id: "rmg", name: "RMG Mortgages (FCX)", tier: "prime" },
  { id: "scotia", name: "Scotia Bank / Banque Scotia", tier: "prime" },
  { id: "td", name: "TD Canada Trust", tier: "prime" },
  { id: "alterna", name: "Alterna", tier: "alt" },
  { id: "community-trust", name: "Community Trust", tier: "alt" },
  { id: "advanced-mic", name: "Advanced MIC", tier: "private" },
  { id: "alta-west", name: "Alt- Alta West Capital", tier: "private" }
];

function LenderManagement() {
  const [lenders, setLenders] = useState(BASELINE_LENDERS);
  const [activeTier, setActiveTier] = useState<"prime" | "alt" | "private" | string>("prime");
  const [selectedLender, setSelectedLender] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newLenderName, setNewLenderName] = useState("");
  const [newLenderTier, setNewLenderTier] = useState<"prime" | "alt" | "private">("prime");

  useEffect(() => {
    async function fetchLenders() {
      const { data, error } = await supabase.from("custom_lenders").select("*");
      if (!error && data) {
        const combined = [...BASELINE_LENDERS, ...data];
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        setLenders(unique);
      }
    }
    fetchLenders();
  }, []);

  const handleCreateLender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLenderName.trim()) return;

    setLoading(true);
    const formattedId = newLenderName.toLowerCase().trim().replace(/[^a-z0-9]/g, "-");
    
    const { error } = await supabase
      .from("custom_lenders")
      .insert([{ id: formattedId, name: newLenderName.trim(), tier: newLenderTier }]);

    if (error) {
      alert("Error adding item to database: " + error.message);
      setLoading(false);
      return;
    }

    const updatedList = [...lenders, { id: formattedId, name: newLenderName.trim(), tier: newLenderTier }];
    setLenders(updatedList);
    setActiveTier(newLenderTier);
    setSelectedLender(formattedId);
    setNewLenderName("");
    setIsFormOpen(false);
    setLoading(false);
  };

  const currentTierLenders = lenders.filter(item => item.tier === activeTier);

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border bg-secondary/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Underwriting Allocation Matrix</h4>
            <p className="text-xs text-muted-foreground">Connected to live Supabase cloud database</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Lending Channel Category
          </label>
          <div className="grid grid-cols-3 gap-1 bg-secondary p-1 rounded-lg border border-border">
            {(["prime", "alt", "private"] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => { setActiveTier(tier); setSelectedLender(""); }}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                  activeTier === tier
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tier === "prime" ? "Prime" : tier === "alt" ? "Alt" : "Private / MIC"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Target Funding Destination
          </label>
          <div className="relative">
            <select
              value={selectedLender}
              onChange={(e) => setSelectedLender(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2 pl-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
            >
              <option value="">-- Choose active platform options --</option>
              {currentTierLenders.map((lender) => (
                <option key={lender.id} value={lender.id}>
                  {lender.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {!isFormOpen ? (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="w-full py-2 border border-dashed border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Append Custom Institution
          </button>
        ) : (
          <form onSubmit={handleCreateLender} className="bg-secondary/30 border border-border rounded-lg p-3 space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Institution Legal Name</label>
              <input
                type="text"
                value={newLenderName}
                onChange={(e) => setNewLenderName(e.target.value)}
                placeholder="e.g. Pacific Northwest Credit Union"
                className="w-full bg-background border border-border rounded-md py-1.5 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Target Allocation</label>
                <select
                  value={newLenderTier}
                  onChange={(e) => setNewLenderTier(e.target.value as any)}
                  className="bg-background border border-border rounded-md py-1 px-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="prime">Prime (A-Side)</option>
                  <option value="alt">Alternative (B-Side)</option>
                  <option value="private">Private / MIC</option>
                </select>
              </div>

              <div className="flex items-center gap-2 self-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-slate-900 text-white px-3 py-1 text-xs rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Save
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── ANALYZING OVERLAY ────────────────────────── */

function AnalyzingOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]"
      style={{ background: "color-mix(in oklab, var(--background) 78%, transparent)" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-2 w-2 animate-pulse"
          style={{ background: "var(--emerald)" }}
        />
        <span className="font-mono text-[10px] font-bold tracking-[0.22em]" style={{ color: "var(--emerald-deep)" }}>
          AI ANALYZING DOCUMENT
        </span>
      </div>
      <div className="font-mono text-[10.5px] text-muted-foreground">{label}…</div>
      <div className="mt-1 h-[2px] w-40 overflow-hidden bg-border">
        <div
          className="h-full w-1/2 animate-pulse"
          style={{ background: "var(--emerald)" }}
        />
      </div>
    </div>
  );
}

/* ────────────────────────── TOP BAR ────────────────────────── */

function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center"
            style={{ background: "var(--emerald-deep)" }}
          >
            <Layers className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold tracking-tight">BrokerMind</span>
            <span className="text-[15px] font-bold tracking-tight" style={{ color: "var(--emerald)" }}>
              AI
            </span>
          </div>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {["Pipeline", "Adjudication", "Conditions", "Compliance", "Reports"].map((n, i) => (
            <a
              key={n}
              className={`px-3 py-1.5 text-[12.5px] font-medium tracking-tight ${
                i === 1
                  ? "text-foreground border-b-2 -mb-[17px] pb-[14px]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={i === 1 ? { borderColor: "var(--emerald)" } : undefined}
              href="#"
            >
              {n}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search applications, brokers, conditions…"
            className="h-8 w-72 border border-border bg-secondary pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground hover:text-foreground">
          <Bell className="h-3.5 w-3.5" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground hover:text-foreground">
          <Settings className="h-3.5 w-3.5" />
        </button>
        <div
          className="flex h-8 w-8 items-center justify-center text-[11px] font-semibold text-primary-foreground"
          style={{ background: "var(--emerald-deep)" }}
        >
          AK
        </div>
      </div>
    </header>
  );
}

function SubHeader({
  applicationNumber = "APP-2025-08842",
  taxpayerName = "Mujeeb Minhas",
}: {
  applicationNumber?: string;
  taxpayerName?: string;
}) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-secondary/60 px-6 text-[11.5px]">
      <div className="flex items-center gap-4">
        <span className="font-mono text-muted-foreground">FILE</span>
        <span className="font-mono font-semibold tracking-wide">#{applicationNumber}</span>
        <span className="text-border">│</span>
        <span className="text-muted-foreground">Applicant</span>
        <span className="font-semibold">{taxpayerName}</span>
        <span className="text-border">│</span>
        <span className="text-muted-foreground">Lender</span>
        <span className="font-semibold">First National A-Lender</span>
        <span className="text-border">│</span>
        <span className="text-muted-foreground">Product</span>
        <span className="font-semibold">5Y Fixed Insured · 78% LTV</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" /> SLA 4h 12m
        </span>
        <span
          className="flex items-center gap-1.5 px-2 py-0.5 font-semibold"
          style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
        >
          <CircleDot className="h-2.5 w-2.5" /> IN ADJUDICATION
        </span>
      </div>
    </div>
  );
}

/* ────────────────────── COLUMN 1: DOCUMENT LENS ────────────────────── */

function DocumentLens({
  incomeOverride,
  setIncomeOverride,
}: {
  incomeOverride: IncomeOverride;
  setIncomeOverride: React.Dispatch<React.SetStateAction<IncomeOverride>>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        icon={<FileText className="h-3.5 w-3.5" />}
        kicker="01"
        title="Forensic Document Lens"
        subtitle="Side-by-side extraction with audit trail"
      />
      <div className="grid flex-1 grid-cols-2 gap-px overflow-hidden bg-border">
        <div className="flex flex-col bg-secondary/40">
          <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-[11px] font-medium">
                CRA_Notice_of_Assessment_2025.pdf
              </span>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">1 / 3</span>
          </div>
          <div className="relative flex-1 overflow-auto p-4">
            <div className="mx-auto max-w-[280px] bg-card p-5 shadow-[0_1px_0_var(--border),0_8px_24px_-12px_rgba(15,42,30,0.15)]">
              <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="text-[8px] font-bold tracking-[0.18em] text-muted-foreground">
                    CANADA REVENUE AGENCY
                  </div>
                  <div className="text-[10px] font-semibold">Notice of Assessment</div>
                </div>
                <div className="text-right text-[8px] text-muted-foreground">
                  <div>Tax Year</div>
                  <div className="font-bold text-foreground">2025</div>
                </div>
              </div>

              <div className="space-y-1 text-[8.5px]">
                <Row label="Name" value="MINHAS, MUJEEB" />
                <Row label="SIN" value="••• ••• 421" />
                <Row label="Date Issued" value="2025-05-14" />
              </div>

              <div className="mt-3 border-t border-border pt-2 text-[8.5px]">
                <div className="mb-1 font-semibold text-foreground">Summary</div>
                <Row label="Line 10100 — Employment" value="$78,420.00" />
                <Row label="Line 12000 — Dividends" value="$12,180.00" />
                <Row label="Line 13000 — Other" value="$3,900.00" />
                <Row label="Line 15000 — Total Income" value="$94,500.00" emphasis />
                <Row label="Line 23600 — Net Income" value="$88,940.12" />
                <Row label="Line 26000 — Taxable" value="$88,940.12" />
              </div>

              <div className="mt-3 border-t border-border pt-2 text-[8.5px]">
                <div className="mb-1 font-semibold text-foreground">Assessment</div>
                <Row label="Federal Tax" value="$14,231.04" />
                <Row label="Provincial Tax" value="$8,902.55" />
                <Row label="Less: Credits" value="-$2,118.00" />
                <Row label="Total Payable" value="$21,015.59" />
                <Row label="Tax Deducted" value="-$16,765.28" />
                <div
                  className="mt-1 flex items-center justify-between border px-1.5 py-1 font-bold"
                  style={{
                    borderColor: "var(--warning)",
                    background: "var(--warning-bg)",
                    color: "var(--warning-fg)",
                  }}
                >
                  <span>BALANCE OWING</span>
                  <span>$4,250.31</span>
                </div>
              </div>

              <div className="mt-3 border-t border-dashed border-border pt-2 text-center text-[7px] tracking-widest text-muted-foreground">
                — END OF NOTICE —
              </div>
            </div>
            <div className="mt-3 text-center font-mono text-[9px] text-muted-foreground">
              Page 1 · CRA-NOA-2025 · OCR confidence 98.4%
            </div>
          </div>
        </div>

        <div className="flex flex-col bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold tracking-tight">Extracted Fields</span>
            <span
              className="flex items-center gap-1 font-mono text-[10px]"
              style={{ color: "var(--emerald)" }}
            >
              <ShieldCheck className="h-3 w-3" /> VERIFIED
            </span>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <div className="grid grid-cols-1 gap-2">
              <Field icon={<User />} label="Taxpayer Name" value="Mujeeb Minhas" />
              <Field icon={<Hash />} label="SIN (Masked)" value="••• ••• 421" mono />
              <Field icon={<Calendar />} label="Tax Year" value="2025" mono />
              <Field
                icon={<DollarSign />}
                label="Line 15000 · Total Income"
                value="$94,500.00"
                mono
                accent
              />
              <Field icon={<DollarSign />} label="Line 23600 · Net Income" value="$88,940.12" mono />
              <Field icon={<Building2 />} label="Issuing Agency" value="Canada Revenue Agency" />
            </div>

            <div
              className="mt-4 border-l-4 p-3"
              style={{
                borderColor: "var(--warning)",
                background: "var(--warning-bg)",
                color: "var(--warning-fg)",
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em]">
                    Warning · CRA Arrears
                  </div>
                  <p className="mt-1 text-[12px] font-semibold leading-snug">
                    Balance owing of <span className="font-mono">$4,250.31</span> detected at
                    assessment.
                  </p>
                  <p className="mt-1 text-[11px] leading-snug opacity-90">
                    Triggers condition INC-04. Lender requires proof of payment or CRA payment
                    arrangement prior to instruction.
                  </p>
                  <div className="mt-2 flex items-center gap-2 font-mono text-[9.5px] opacity-80">
                    <span>SRC: Line-Balance-Owing</span>
                    <span>·</span>
                    <span>CONF: 99.1%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Cross-Document Reconciliation
              </div>
              <ReconRow doc="T4 — Employer Inc." val="$78,420.00" status="MATCH" />
              <ReconRow doc="T5 — Dividends" val="$12,180.00" status="MATCH" />
              <ReconRow
                doc="Stated Income (App)"
                val={incomeOverride ? incomeOverride.value : "$96,000.00"}
                status={incomeOverride ? "RECONCILED" : "VARIANCE"}
                tone={incomeOverride ? "ok" : "warn"}
                delta={incomeOverride ? "OVERRIDE" : "+1.6%"}
                onClick={incomeOverride ? undefined : () => setModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>
      {modalOpen && (
        <IncomeOverrideModal
          onClose={() => setModalOpen(false)}
          onApply={(value, note) => {
            setIncomeOverride({
              value,
              note,
              appliedAt: new Date().toLocaleString("en-CA", { hour12: false }),
            });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function IncomeOverrideModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (value: string, note: string) => void;
}) {
  const [value, setValue] = useState("$94,500.00");
  const [note, setNote] = useState(
    "Stated income reconciled to CRA Line 15000 per OSFI B-20 §5.1.1. Variance within tolerance; T4 + T5 corroborated."
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-border bg-card shadow-[0_20px_60px_-20px_rgba(15,42,30,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b border-border px-4 py-3"
          style={{ background: "var(--emerald-deep)" }}
        >
          <div className="flex items-center gap-2 text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
            <h3 className="text-[13px] font-bold tracking-tight">Manual Income Reconciliation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-primary-foreground/80 hover:text-primary-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2 border border-border bg-secondary/50 p-2 text-[10.5px]">
            <div>
              <div className="text-muted-foreground">Stated (App)</div>
              <div className="font-mono font-bold">$96,000.00</div>
            </div>
            <div>
              <div className="text-muted-foreground">CRA Line 15000</div>
              <div className="font-mono font-bold">$94,500.00</div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Underwriter Reconciled Income
            </label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 w-full border border-border bg-background px-2.5 font-mono text-[12.5px] font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              OSFI B-20 Compliance Justification Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full resize-none border border-border bg-background px-2.5 py-2 text-[11.5px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <button
              onClick={onClose}
              className="border border-border bg-card px-3 py-1.5 text-[11px] font-semibold tracking-tight hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(value, note)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11.5px] font-bold tracking-tight text-primary-foreground"
              style={{ background: "var(--emerald-deep)" }}
            >
              Apply Override
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={emphasis ? "font-bold text-foreground" : "font-mono text-foreground"}>
        {value}
      </span>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="border border-border bg-card px-3 py-2 hover:border-foreground/30">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>
        {label}
      </div>
      <div
        className={`mt-0.5 text-[13px] ${mono ? "font-mono" : ""} ${
          accent ? "font-bold" : "font-semibold"
        }`}
        style={accent ? { color: "var(--emerald-deep)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function ReconRow({
  doc,
  val,
  status,
  tone = "ok",
  delta,
  onClick,
}: {
  doc: string;
  val: string;
  status: string;
  tone?: "ok" | "warn";
  delta?: string;
  onClick?: () => void;
}) {
  const color =
    tone === "warn"
      ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
      : { background: "color-mix(in oklab, var(--success) 14%, transparent)", color: "var(--success)" };
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`flex items-center justify-between border-b border-border py-1.5 text-[11px] last:border-0 ${onClick ? "cursor-pointer hover:bg-secondary/60 px-1 -mx-1 transition-colors" : ""}`}
    >
      <span className="truncate text-foreground">{doc}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-muted-foreground">{val}</span>
        {delta && <span className="font-mono text-[10px] text-muted-foreground">{delta}</span>}
        <span className="px-1.5 py-px font-mono text-[9.5px] font-bold tracking-wider" style={color}>
          {status}
        </span>
      </div>
    </div>
  );
}

/* ────────────────────── COLUMN 2: SCORING MATRIX ────────────────────── */

function ScoringMatrix({
  craCleared,
  analysis,
  debtService,
  extraFlags = [],
  ltv,
  highRatio,
}: {
  craCleared: boolean;
  analysis: NoaAnalysis | null;
  debtService: any;
  extraFlags?: RiskFlag[];
  ltv: number;
  highRatio: boolean;
}) {
  const score = craCleared ? 30 : 45;
  const riskLabel = craCleared ? "Low Risk" : "Moderate Risk";
  const riskBg = craCleared
    ? "color-mix(in oklab, var(--success) 16%, transparent)"
    : "var(--warning-bg)";
  const riskFg = craCleared ? "var(--success)" : "var(--warning-fg)";
  return (
    <div className="flex h-full flex-col overflow-auto">
      <PaneHeader
        icon={<Activity className="h-3.5 w-3.5" />}
        kicker="02"
        title="Dynamic Scoring Matrix"
        subtitle="B-20 stress-tested qualification"
      />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <DebtRatioCard
            label="Stress-Tested GDS"
            value={debtService.gds}
            cap={debtService.gdsCap}
            exceeded={debtService.gdsExceeded}
          />
          <DebtRatioCard
            label="Stress-Tested TDS"
            value={debtService.tds}
            cap={debtService.tdsCap}
            exceeded={debtService.tdsExceeded}
          />
          <RatioCard
            label="LTV Ratio"
            value={ltv.toFixed(1)}
            cap={highRatio ? "Insured" : "Conv."}
            tone={highRatio ? "bad" : "good"}
          />
        </div>

        <div className="border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Aggregate Risk Score
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-[44px] font-bold leading-none text-foreground transition-all duration-300">
                  {score}
                </span>
                <span className="font-mono text-[13px] text-muted-foreground">/ 100</span>
              </div>
              <div
                className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] transition-colors"
                style={{ background: riskBg, color: riskFg }}
              >
                <CircleDot className="h-2.5 w-2.5" /> {riskLabel}
              </div>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              <div>Model</div>
              <div className="font-mono text-foreground">BMA-RISK v4.2</div>
              <div className="mt-1">Updated</div>
              <div className="font-mono text-foreground">14:02:11</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="relative h-2 w-full bg-secondary">
              <div
                className="absolute left-0 top-0 h-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: "linear-gradient(90deg, var(--success), var(--warning))",
                }}
              />
              <div
                className="absolute top-[-3px] h-3 w-[2px] transition-all duration-500"
                style={{ left: `${score}%`, background: "var(--foreground)" }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9.5px] text-muted-foreground">
              <span>0 LOW</span>
              <span>50</span>
              <span>100 SEVERE</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-[10.5px]">
            <Mini label="Capacity" v="62" />
            <Mini label="Credit" v="38" />
            <Mini label="Collateral" v="35" />
          </div>
        </div>

        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold tracking-tight">Triggered Risk Flags</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {(() => {
                const base = craCleared ? 1 : 2;
                const debt = debtService.gdsExceeded || debtService.tdsExceeded ? 1 : 0;
                return `${base + debt + extraFlags.length} ACTIVE`;
              })()}
            </span>
          </div>
          <div className="divide-y divide-border">
            <FlagRow
              code="TAX-CRA-ARREARS"
              title={craCleared ? "Cleared by condition INC-04" : "CRA balance owing detected"}
              severity={craCleared ? "Cleared" : "Elevated"}
              penalty={craCleared ? "—" : "+15"}
              tone={craCleared ? "cleared" : "warn"}
              icon={<Receipt className="h-3.5 w-3.5" />}
            />
            <FlagRow
              code="INC-DROP-YOY"
              title="Year-over-year income variance"
              severity="None"
              penalty="Stable"
              tone="ok"
              icon={<TrendingDown className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── AUXILIARY INNER COMPONENTS ────────────────────── */

function PaneHeader({ icon, kicker, title, subtitle }: { icon: React.ReactNode; kicker: string; title: string; subtitle: string }) {
  return (
    <div className="border-b border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground">{kicker}</span>
        <div className="flex h-5 w-5 items-center justify-center rounded border border-border bg-secondary text-muted-foreground [&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </div>
        <h2 className="text-[13px] font-bold tracking-tight">{title}</h2>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function DebtRatioCard({ label, value, cap, exceeded }: { label: string; value: number; cap: number; exceeded: boolean }) {
  return (
    <div className={`border p-2.5 ${exceeded ? "border-destructive bg-destructive/10" : "border-border bg-card"}`}>
      <div className="text-[9.5px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">{value.toFixed(2)}%</div>
      <div className="text-[9px] text-muted-foreground">Cap: {cap}%</div>
    </div>
  );
}

function RatioCard({ label, value, cap, tone }: { label: string; value: string; cap: string; tone: "good" | "bad" }) {
  return (
    <div className="border border-border bg-card p-2.5">
      <div className="text-[9.5px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">{value}%</div>
      <div className="text-[9px] text-muted-foreground">Type: {cap}</div>
    </div>
  );
}

function Mini({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[9px] uppercase tracking-wider">{label}</div>
      <div className="font-mono font-bold text-foreground mt-0.5">{v}</div>
    </div>
  );
}

function FlagRow({ code, title, severity, penalty, tone, icon }: { code: string; title: string; severity: string; penalty: string; tone: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3 text-[11px]">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="font-mono text-[9.5px] font-semibold text-muted-foreground">{code}</div>
          <div className="truncate text-foreground font-medium mt-0.5">{title}</div>
        </div>
      </div>
      <div className="text-right font-mono text-[10px] shrink-0 pl-4">
        <div className={tone === "warn" ? "text-destructive font-bold" : "text-muted-foreground"}>{severity}</div>
        <div className="text-muted-foreground text-[9px] mt-0.5">{penalty}</div>
      </div>
    </div>
  );
}

function ConditionsPanel({ conditions, setConditions, incomeOverride, analysis }: any) {
  return (
    <div className="p-4 bg-card border border-border h-full">
      <PaneHeader
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        kicker="03"
        title="Automated Conditions"
        subtitle="Dynamic risk mitigation checklist"
      />
      <div className="mt-3 space-y-2">
        {conditions.map((c: any) => (
          <div key={c.id} className="flex items-start gap-2 text-[11.5px] border border-border p-2 bg-background">
            <input
              type="checkbox"
              checked={c.satisfied}
              onChange={(e) => {
                setConditions(conditions.map((item: any) => item.id === c.id ? { ...item, satisfied: e.target.checked } : item));
              }}
              className="mt-0.5"
            />
            <div>
              <div className="font-mono text-[9.5px] font-bold">{c.id}</div>
              <div className="text-foreground mt-0.5">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const initialConditions = [
  { id: "INC-01", desc: "Provide primary employment verification letter matching stated parameters.", satisfied: false },
  { id: "INC-04", desc: "Proof of clearing CRA balance owing or structured arrangement documentation.", satisfied: false },
  { id: "COLL-02", desc: "Satisfactory independent real estate appraisal report confirming market valuation.", satisfied: false }
];
