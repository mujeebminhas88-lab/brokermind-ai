import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  PlusCircle,
  Trash2
} from "lucide-react";
import { NoaUploader } from "@/components/NoaUploader";
import { SandboxToggleBar, SandboxPanel } from "@/components/SandboxPanel";
import { PipelineLedger, SaveApplicationButton } from "@/components/PipelineLedger";
import { ExportAuditSheetButton } from "@/components/ExportAuditSheet";
import { LiabilitiesPanel, DEFAULT_LIABILITIES, type LiabilityInputs } from "@/components/LiabilitiesPanel";
import { CollateralPanel, DEFAULT_COLLATERAL, computeLtv, type CollateralState } from "@/components/CollateralPanel";
import { EmploymentIntakePanel, DEFAULT_EMPLOYMENT, type EmploymentState } from "@/components/EmploymentIntakePanel";
import { LenderManagement } from "@/components/LenderManagement";
import { calculateDebtService } from "@/utils/debtService";
import type { NoaAnalysis, RiskFlag } from "@/utils/noaParser";

const DEFAULT_APP_NUMBER = "APP-2025-08842";
const DEFAULT_TAXPAYER = "Mujeeb Minhas";
const DEFAULT_QUALIFYING_INCOME = 94500;

type IncomeOverride = { value: string; note: string; appliedAt: string } | null;

interface AdditionalProperty {
  id: string;
  address: string;
  usage: "rental" | "second-home" | "vacant";
  status: "mortgaged" | "free-and-clear";
  mortgagePayment: number;
  propertyTax: number;
  heatingCosts: number;
  grossRentalIncome: number;
  rentalCalculationMethod: "net-effective" | "gross-add-to-income" | "debt-service-offset";
  rentalInclusionPercentage: number;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrokerMindAI — Underwriter Adjudication Workspace" },
      {
        name: "description",
        content:
          "Executive mortgage adjudication dashboard: forensic document lens, dynamic scoring matrix, and conditions automation.",
      },
    ],
  }),
  component: Dashboard,
});

const initialConditions = [
  { id: "INC-01", category: "Income", title: "Verify Line 15000 Total Income", satisfied: true },
  { id: "INC-04", category: "Income", title: "CRA Arrears Proof of Payment", satisfied: false },
  { id: "PROP-01", category: "Property", title: "Appraisal Report Valuation Match", satisfied: false }
];

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

  // Lender Match States
  const [selectedTerm, setSelectedTerm] = useState<string>("5y");
  const [rateType, setRateType] = useState<"fixed" | "variable">("fixed");
  const [amortization, setAmortization] = useState<string>("25");

  // Real Estate Owned Portfolio state
  const [additionalProperties, setAdditionalProperties] = useState<AdditionalProperty[]>([]);

  const addProperty = () => {
    const newProp: AdditionalProperty = {
      id: crypto.randomUUID(),
      address: "",
      usage: "rental",
      status: "mortgaged",
      mortgagePayment: 0,
      propertyTax: 0,
      heatingCosts: 0,
      grossRentalIncome: 0,
      rentalCalculationMethod: "debt-service-offset",
      rentalInclusionPercentage: 50
    };
    setAdditionalProperties([...additionalProperties, newProp]);
  };

  const removeProperty = (id: string) => {
    setAdditionalProperties(additionalProperties.filter(p => p.id !== id));
  };

  const updateProperty = (id: string, fields: Partial<AdditionalProperty>) => {
    setAdditionalProperties(additionalProperties.map(p => p.id === id ? { ...p, ...fields } : p));
  };

  // Compute modified liabilities and income parameters based on REO Portfolio choices
  let rentalIncomeAddition = 0;
  let reoLiabilitiesAddition = 0;

  additionalProperties.forEach(p => {
    const calculatedRent = (p.grossRentalIncome * (p.rentalInclusionPercentage / 100));
    const carryCosts = (p.status === "mortgaged" ? p.mortgagePayment : 0) + p.propertyTax + p.heatingCosts;

    if (p.usage === "rental") {
      if (p.rentalCalculationMethod === "gross-add-to-income") {
        rentalIncomeAddition += calculatedRent;
        reoLiabilitiesAddition += carryCosts;
      } else if (p.rentalCalculationMethod === "debt-service-offset") {
        const netOffset = calculatedRent - carryCosts;
        if (netOffset < 0) {
          reoLiabilitiesAddition += Math.abs(netOffset);
        } else {
          rentalIncomeAddition += netOffset;
        }
      }
    } else {
      reoLiabilitiesAddition += carryCosts;
    }
  });

  const baseQualifyingIncome = analysis?.payload.line_15000_total_income ?? DEFAULT_QUALIFYING_INCOME;
  const totalQualifyingIncome = baseQualifyingIncome + rentalIncomeAddition;

  const adjustedLiabilities = {
    ...liabilities,
    otherMitigations: (liabilities.otherMitigations || 0) + reoLiabilitiesAddition
  };

  const debtService = calculateDebtService(totalQualifyingIncome, adjustedLiabilities);
  const ltvCalc = computeLtv(collateral);

  const extraFlags = [...collateralFlags, ...employmentFlags];
  const extraPenalty = extraFlags.reduce((s, f) => s + f.penalty, 0);
  const craCleared = conditions.find((c) => c.id === "INC-04")?.satisfied ?? false;
  const baseScore = craCleared ? 30 : 45;
  const debtServicePenalty = (debtService.gdsExceeded ? 18 : 0) + (debtService.tdsExceeded ? 22 : 0);
  const aggregateRiskScore = (analysis ? analysis.aggregatePenalty : baseScore) + debtServicePenalty + extraPenalty;
  const taxpayerName = analysis?.payload.taxpayer_name ?? DEFAULT_TAXPAYER;

  return (
    <div className="min-h-screen bg-background font-display text-foreground antialiased">
      <GlobalHeader />
      <SubHeader applicationNumber={applicationNumber} taxpayerName={taxpayerName} />
      
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        
        {/* Dynamic Product Execution Parameters Row */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" /> Underwriting Product Parameters
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-muted-foreground font-medium mb-1.5">Amortization Period</label>
              <select 
                value={amortization} 
                onChange={(e) => setAmortization(e.target.value)}
                className="w-full bg-background border border-border rounded p-2 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="15">15 Years</option>
                <option value="20">20 Years</option>
                <option value="25">25 Years (Standard)</option>
                <option value="30">30 Years (Uninsured)</option>
              </select>
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1.5">Rate Program Structure</label>
              <div className="grid grid-cols-2 gap-1 bg-secondary/50 p-1 rounded border border-border">
                <button 
                  onClick={() => setRateType("fixed")}
                  className={`py-1 text-center font-semibold rounded transition-all ${rateType === "fixed" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"}`}
                >
                  Fixed
                </button>
                <button 
                  onClick={() => setRateType("variable")}
                  className={`py-1 text-center font-semibold rounded transition-all ${rateType === "variable" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"}`}
                >
                  Variable
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-muted-foreground font-medium mb-1.5">Contract Commit Term</label>
              <div className="flex flex-wrap gap-1 bg-secondary/50 p-1 rounded border border-border">
                {["6m", "1y", "2y", "3y", "4y", "5y", "6y", "7y"].map((term) => (
                  <button
                    key={term}
                    onClick={() => setSelectedTerm(term)}
                    className={`flex-1 py-1 text-center font-mono font-bold text-[11px] rounded uppercase transition-all ${selectedTerm === term ? "bg-emerald-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lender Management Dashboard Wrapper Component */}
        <div className="overflow-hidden">
          {LenderManagement ? (
            <LenderManagement />
          ) : (
            <div className="p-3 border border-red-200 bg-red-50 text-red-700 text-xs rounded-lg">
              Lender Core Module Component Unresolved. Check dynamic local bindings.
            </div>
          )}
        </div>

        {/* Real Estate Owned (REO) Portfolio Control Engine */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Real Estate Owned (REO) Schedule</h3>
              <p className="text-[11px] text-muted-foreground">Manage multi-property portfolio carry costs and matching multi-lender rental wash metrics.</p>
            </div>
            <button 
              onClick={addProperty}
              className="flex items-center gap-1.5 bg-secondary text-foreground border border-border hover:bg-secondary/80 px-2.5 py-1 text-xs font-medium rounded transition-all"
            >
              <PlusCircle className="h-3.5 w-3.5 text-emerald-600" /> Add Portfolio Asset
            </button>
          </div>

          {additionalProperties.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground font-mono">
              No secondary or rental holdings listed on file. Net global calculations operating on base criteria inputs.
            </div>
          ) : (
            <div className="space-y-4">
              {additionalProperties.map((prop) => (
                <div key={prop.id} className="p-3 bg-secondary/20 border border-border rounded-lg grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs relative group">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">Asset Street Address</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 88 King St West, Toronto"
                      value={prop.address} 
                      onChange={(e) => updateProperty(prop.id, { address: e.target.value })}
                      className="w-full bg-background border border-border rounded px-2 py-1 focus:outline-none focus:border-emerald-500" 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">Asset Usage</label>
                    <select 
                      value={prop.usage} 
                      onChange={(e) => updateProperty(prop.id, { usage: e.target.value as any })}
                      className="w-full bg-background border border-border rounded p-1 focus:outline-none"
                    >
                      <option value="rental">Rental Holding</option>
                      <option value="second-home">Secondary Home</option>
                      <option value="vacant">Vacant Asset</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">Financing Status</label>
                    <select 
                      value={prop.status} 
                      onChange={(e) => updateProperty(prop.id, { status: e.target.value as any })}
                      className="w-full bg-background border border-border rounded p-1 focus:outline-none"
                    >
                      <option value="mortgaged">Mortgaged</option>
                      <option value="free-and-clear">Free & Clear</option>
                    </select>
                  </div>
                  
                  {prop.status === "mortgaged" && (
                    <div className="md:col-span-1.5">
                      <label className="block text-[11px] text-muted-foreground font-medium mb-1">Mo. Mortgage ($)</label>
                      <input 
                        type="number" 
                        value={prop.mortgagePayment || ""} 
                        onChange={(e) => updateProperty(prop.id, { mortgagePayment: Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded px-2 py-1 font-mono" 
                      />
                    </div>
                  )}

                  <div className="md:col-span-1.5">
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">Mo. Taxes/Heat ($)</label>
                    <input 
                      type="number" 
                      value={prop.propertyTax || ""} 
                      onChange={(e) => updateProperty(prop.id, { propertyTax: Number(e.target.value) })}
                      className="w-full bg-background border border-border rounded px-2 py-1 font-mono" 
                    />
                  </div>

                  {prop.usage === "rental" && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground font-medium mb-1">Gross Monthly Rent ($)</label>
                        <input 
                          type="number" 
                          value={prop.grossRentalIncome || ""} 
                          onChange={(e) => updateProperty(prop.id, { grossRentalIncome: Number(e.target.value) })}
                          className="w-full bg-background border border-border rounded px-2 py-1 font-mono text-emerald-600 font-bold" 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground font-medium mb-1">Calculation Method</label>
                        <select 
                          value={prop.rentalCalculationMethod} 
                          onChange={(e) => updateProperty(prop.id, { rentalCalculationMethod: e.target.value as any })}
                          className="w-full bg-background border border-border rounded p-1 focus:outline-none"
                        >
                          <option value="debt-service-offset">Rental Offset (TDS Reduction)</option>
                          <option value="gross-add-to-income">Add to Gross Qualification</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground font-medium mb-1">Lender Inclusion %</label>
                        <select 
                          value={prop.rentalInclusionPercentage} 
                          onChange={(e) => updateProperty(prop.id, { rentalInclusionPercentage: Number(e.target.value) })}
                          className="w-full bg-background border border-border rounded p-1 focus:outline-none font-mono"
                        >
                          <option value="50">50% Standard Matrix</option>
                          <option value="70">70% Extended Tier</option>
                          <option value="100">100% Full Yield</option>
                        </select>
                      </div>
                    </>
                  )}
                  
                  <div className="md:col-span-1 text-right">
                    <button 
                      onClick={() => removeProperty(prop.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-500 rounded border border-transparent hover:border-border transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Action Sync Bar */}
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

        {/* Core Processing Component Modules */}
        <CollateralPanel state={collateral} setState={setCollateral} onFlagsChange={setCollateralFlags} />

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
        
        <LiabilitiesPanel liabilities={liabilities} setLiabilities={setLiabilities} result={debtService} />
        <EmploymentIntakePanel state={employment} setState={setEmployment} onFlagsChange={setEmploymentFlags} />
        
        {/* Adjudication Core Split Workspace Deck */}
        <main className="grid grid-cols-12 gap-px bg-border" style={{ minHeight: "calc(100vh - 168px)" }}>
          <section className="col-span-12 lg:col-span-5 bg-background overflow-hidden">
            <DocumentLens incomeOverride={incomeOverride} setIncomeOverride={setIncomeOverride} />
          </section>
          <section className="col-span-12 lg:col-span-4 bg-background overflow-hidden relative">
            <ScoringMatrix craCleared={craCleared} analysis={analysis} debtService={debtService} extraFlags={extraFlags} ltv={ltvCalc.ltv} highRatio={ltvCalc.highRatio} />
            {analyzing && <AnalyzingOverlay label="Scoring matrix recalculating" />}
          </section>
          <section className="col-span-12 lg:col-span-3 bg-background overflow-hidden relative">
            <ConditionsPanel conditions={conditions} setConditions={setConditions} incomeOverride={incomeOverride} analysis={analysis} />
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

/* ────────────────────────── RESTORED ORIGINAL MASTER NAV BAR ────────────────────────── */

function GlobalHeader() {
  const tabs = ["Pipeline", "Adjudication", "Conditions", "Compliance", "Reports"];
  const [activeTab, setActiveTab] = useState("Adjudication");

  return (
    <header className="bg-card border-b border-border h-14 px-6 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-emerald-700 rounded flex items-center justify-center text-white font-bold text-xs">B</div>
          <span className="font-bold tracking-tight text-sm text-foreground">
            BrokerMind <span className="text-emerald-600">AI</span>
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-1 h-14">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-full px-4 text-xs font-semibold border-b-2 transition-all duration-150 ${activeTab === tab ? "border-emerald-600 text-emerald-600 bg-emerald-500/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 max-w-sm w-full md:w-72 relative">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search applications, brokers, conditions..."
            className="w-full bg-secondary/40 border border-border rounded-lg pl-8 pr-3 py-1.5 text-[11.5px] focus:outline-none focus:border-emerald-500 transition-all placeholder:text-muted-foreground"
          />
        </div>
        <button className="p-1.5 text-muted-foreground hover:text-foreground transition-all relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-emerald-600 rounded-full" />
        </button>
      </div>
    </header>
  );
}

/* ────────────────────────── BACKGROUND OVERLAYS AND MISC PANES ────────────────────────── */

function AnalyzingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]" style={{ background: "color-mix(in oklab, var(--background) 78%, transparent)" }}>
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 animate-pulse bg-emerald-500" />
        <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-emerald-800">AI ANALYZING DOCUMENT</span>
      </div>
      <div className="font-mono text-[10.5px] text-muted-foreground">{label}…</div>
    </div>
  );
}

function PaneHeader({ icon, kicker, title, subtitle }: { icon: React.ReactNode; kicker: string; title: string; subtitle: string }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground">{kicker}</span>
          <h2 className="text-[12.5px] font-bold tracking-tight truncate text-foreground">{title}</h2>
          <span className="hidden text-[11px] text-muted-foreground sm:inline truncate">· {subtitle}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${emphasis ? "font-bold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function ReconRow({ doc, val, status, tone, delta }: { doc: string; val: string; status: string; tone?: "ok" | "warn"; delta?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border text-[11px]">
      <span className="text-muted-foreground">{doc}</span>
      <div className="flex items-center gap-2 font-mono">
        <span>{val}</span>
        <span className={`px-1.5 py-0.5 text-[9px] font-bold ${tone === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {status} {delta ? `(${delta})` : ""}
        </span>
      </div>
    </div>
  );
}

function ScoringMatrix({ craCleared, analysis, debtService, extraFlags, ltv, highRatio }: any) {
  return (
    <div className="flex h-full flex-col p-4 space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">02 · Risk Scoring Matrix</div>
      <div className="bg-secondary/30 p-3 rounded-lg border border-border space-y-2 text-xs">
        <div className="flex justify-between"><span>LTV Ratio</span><span className="font-mono font-bold">{ltv}% ({highRatio ? "High Ratio" : "Conventional"})</span></div>
        <div className="flex justify-between"><span>Adjusted GDS / TDS</span><span className="font-mono text-emerald-700 font-bold">{debtService.gds}% / {debtService.tds}%</span></div>
        <div className="flex justify-between"><span>CRA Status</span><span className={`font-bold ${craCleared ? "text-emerald-600" : "text-amber-600"}`}>{craCleared ? "Cleared" : "Pending Verification"}</span></div>
      </div>
    </div>
  );
}

function ConditionsPanel({ conditions, setConditions }: any) {
  return (
    <div className="flex h-full flex-col p-4 space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">03 · Automated Conditions</div>
      <div className="space-y-2">
        {conditions.map((c: any) => (
          <div key={c.id} className="flex items-start gap-2 p-2 border border-border bg-card rounded text-xs">
            <input type="checkbox" checked={c.satisfied} onChange={(e) => setConditions(conditions.map((item: any) => item.id === c.id ? { ...item, satisfied: e.target.checked } : item))} className="mt-0.5 rounded border-border" />
            <div>
              <div className="font-mono text-[10px] font-bold text-muted-foreground">{c.id} · {c.category}</div>
              <div className="font-medium">{c.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentLens({ incomeOverride, setIncomeOverride }: any) {
  return (
    <div className="flex flex-col h-full border border-border rounded-xl shadow-sm overflow-hidden bg-card">
      <PaneHeader icon={<FileText className="h-4 w-4" />} kicker="WORKSPACE MODULE" title="Forensic Document Lens" subtitle="CRA Direct Integration" />
      <div className="p-4 flex-1 space-y-4">
        <div className="border border-border p-3 rounded-lg space-y-2 bg-card">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CRA Line Reconciliation</span>
          <div className="divide-y divide-border">
            <ReconRow doc="Line 15000 · Total Income" val="$94,500.00" status="Match Verified" tone="ok" />
            <ReconRow doc="Line 10100 · Employment Income" val="$91,200.00" status="Match Verified" tone="ok" />
            <ReconRow doc="Line 23600 · Net Income" val="$88,410.00" status="Delta Flag" tone="warn" delta="-$2,790" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SubHeader({ applicationNumber, taxpayerName }: { applicationNumber: string; taxpayerName: string }) {
  return (
    <div className="border-b border-border bg-secondary/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">{applicationNumber}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <h1 className="text-sm font-bold tracking-tight text-foreground">{taxpayerName}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-500" /> <span className="font-mono">System Nominal</span></div>
      </div>
    </div>
  );
}
