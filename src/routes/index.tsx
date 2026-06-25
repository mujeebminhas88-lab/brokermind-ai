import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  Users,
  Calendar,
  DollarSign,
  X,
  Sparkles,
  Plus,
  Loader2,
  PlusCircle,
  Trash2,
  Sliders,
  Save,
  FilePlus,
  ShieldAlert
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

interface CoApplicantState {
  enabled: boolean;
  name: string;
  onTitle: boolean;
  income: number;
  employmentType: "salaried" | "self-employed" | "contract";
  monthlyLiabilities: number;
}

interface ApplicationRecord {
  id: string;
  taxpayerName: string;
  amortization: number;
  rateType: "fixed" | "variable";
  selectedTerm: string;
  additionalProperties: AdditionalProperty[];
  liabilities: LiabilityInputs;
  collateral: CollateralState;
  conditions: any[];
  coApplicant: CoApplicantState;
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

const DEFAULT_APP_NUMBER = "APP-2025-08842";
const DEFAULT_TAXPAYER = "Mujeeb Minhas";
const DEFAULT_QUALIFYING_INCOME = 94500;

const DEFAULT_RECORDS: ApplicationRecord[] = [
  {
    id: DEFAULT_APP_NUMBER,
    taxpayerName: DEFAULT_TAXPAYER,
    amortization: 25,
    rateType: "fixed",
    selectedTerm: "5y",
    additionalProperties: [],
    liabilities: DEFAULT_LIABILITIES,
    collateral: DEFAULT_COLLATERAL,
    conditions: initialConditions,
    coApplicant: { enabled: false, name: "Ayesha Minhas", onTitle: false, income: 62000, employmentType: "salaried", monthlyLiabilities: 350 }
  }
];

function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("Adjudication");

  // Multi-file Management Pipeline State
  const [applications, setApplications] = useState<ApplicationRecord[]>(DEFAULT_RECORDS);
  const [activeAppId, setActiveAppId] = useState<string>(DEFAULT_APP_NUMBER);
  const [selectedAppIdsForDeletion, setSelectedAppIdsForDeletion] = useState<string[]>([]);

  // Active Context Sub-states
  const [conditions, setConditions] = useState(initialConditions);
  const [incomeOverride, setIncomeOverride] = useState<IncomeOverride>(null);
  const [analysis, setAnalysis] = useState<NoaAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [liabilities, setLiabilities] = useState<LiabilityInputs>(DEFAULT_LIABILITIES);
  const [collateral, setCollateral] = useState<CollateralState>(DEFAULT_COLLATERAL);
  const [employment, setEmployment] = useState<EmploymentState>(DEFAULT_EMPLOYMENT);
  const [collateralFlags, setCollateralFlags] = useState<RiskFlag[]>([]);
  const [employmentFlags, setEmploymentFlags] = useState<RiskFlag[]>([]);

  // Product Execution parameters
  const [selectedTerm, setSelectedTerm] = useState<string>("5y");
  const [rateType, setRateType] = useState<"fixed" | "variable">("fixed");
  const [amortization, setAmortization] = useState<number>(25);
  const [additionalProperties, setAdditionalProperties] = useState<AdditionalProperty[]>([]);
  const [coApplicant, setCoApplicant] = useState<CoApplicantState>({
    enabled: false,
    name: "Ayesha Minhas",
    onTitle: false,
    income: 62000,
    employmentType: "salaried",
    monthlyLiabilities: 350
  });

  // Automated AML Flag Generation Model (Triggers based on document irregularities or high risk ratios)
  const [amlFlags, setAmlFlags] = useState<Array<{ id: string; metric: string; risk: "high" | "medium"; description: string }>>([]);

  // Load persistence database layer on initial render
  useEffect(() => {
    const savedList = localStorage.getItem("brokermind_applications_pipeline");
    if (savedList) {
      try {
        const parsedList = JSON.parse(savedList);
        if (parsedList && parsedList.length > 0) {
          setApplications(parsedList);
          setActiveAppId(parsedList[0].id);
          loadApplicationIntoContext(parsedList[0]);
        }
      } catch (e) {
        console.error("Failed to re-initialize file storage track pipeline ledger", e);
      }
    } else {
      localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(DEFAULT_RECORDS));
    }
  }, []);

  const loadApplicationIntoContext = (app: ApplicationRecord) => {
    setAmortization(app.amortization);
    setRateType(app.rateType);
    setSelectedTerm(app.selectedTerm);
    setAdditionalProperties(app.additionalProperties);
    setLiabilities(app.liabilities);
    setCollateral(app.collateral);
    setConditions(app.conditions);
    setCoApplicant(app.coApplicant);
  };

  useEffect(() => {
    const currentApp = applications.find(a => a.id === activeAppId);
    if (currentApp) {
      loadApplicationIntoContext(currentApp);
    }
  }, [activeAppId]);

  // Dynamically cascade upper-level parameters back down into collateral object structure to avoid desync
  useEffect(() => {
    setCollateral(prev => ({
      ...prev,
      amortization: amortization
    }));
  }, [amortization]);

  // Compute AML verification states adaptively
  useEffect(() => {
    const flags = [];
    if (coApplicant.enabled && !coApplicant.onTitle && coApplicant.income > 100000) {
      flags.push({
        id: "AML-01",
        metric: "Layered Unregistered Asset Structuring",
        risk: "medium" as const,
        description: "Co-applicant providing significant income yield metrics without being attached to the collateral registration asset deed."
      });
    }
    if (additionalProperties.some(p => p.grossRentalIncome > 6000 && p.status === "free-and-clear")) {
      flags.push({
        id: "AML-02",
        metric: "High Yield Unverified Real Estate Cashflow",
        risk: "high" as const,
        description: "Rental property assets displaying disproportionate cash distributions with no verification of underlying acquisition tracking."
      });
    }
    setAmlFlags(flags);
  }, [coApplicant, additionalProperties]);

  const handleManualSave = () => {
    const updatedList = applications.map(app => {
      if (app.id === activeAppId) {
        return {
          ...app,
          amortization,
          rateType,
          selectedTerm,
          additionalProperties,
          liabilities,
          collateral: { ...collateral, amortization },
          conditions,
          coApplicant
        };
      }
      return app;
    });

    setApplications(updatedList);
    localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(updatedList));
    alert("Application files successfully updated and compiled inside registry pipeline memory.");
  };

  const handleBatchDeleteSelected = () => {
    if (selectedAppIdsForDeletion.length === 0) {
      alert("No application checkbox items targeted for pipeline deletion.");
      return;
    }

    if (confirm(`Acknowledge definitive hard deletion request of ${selectedAppIdsForDeletion.length} processing file records? This action purges all associated underwriting document layers.`)) {
      const remainingList = applications.filter(app => !selectedAppIdsForDeletion.includes(app.id));
      
      if (remainingList.length === 0) {
        setApplications(DEFAULT_RECORDS);
        localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(DEFAULT_RECORDS));
        setActiveAppId(DEFAULT_APP_NUMBER);
        loadApplicationIntoContext(DEFAULT_RECORDS[0]);
      } else {
        setApplications(remainingList);
        localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(remainingList));
        if (selectedAppIdsForDeletion.includes(activeAppId)) {
          setActiveAppId(remainingList[0].id);
          loadApplicationIntoContext(remainingList[0]);
        }
      }
      setSelectedAppIdsForDeletion([]);
      alert("Targeted application registries and document buffers permanently deleted from the system.");
    }
  };

  const handleCreateNewApplication = () => {
    const generatedId = `APP-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const newRecord: ApplicationRecord = {
      id: generatedId,
      taxpayerName: "Unassigned Submission File",
      amortization: 25,
      rateType: "fixed",
      selectedTerm: "5y",
      additionalProperties: [],
      liabilities: DEFAULT_LIABILITIES,
      collateral: DEFAULT_COLLATERAL,
      conditions: initialConditions,
      coApplicant: { enabled: false, name: "", onTitle: false, income: 0, employmentType: "salaried", monthlyLiabilities: 0 }
    };

    const expandedPipeline = [newRecord, ...applications];
    setApplications(expandedPipeline);
    localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(expandedPipeline));
    setActiveAppId(generatedId);
    alert(`Generated completely clear application submission matrix under structural reference token: ${generatedId}`);
  };

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
  const globalCombinedIncome = baseQualifyingIncome + rentalIncomeAddition + (coApplicant.enabled ? coApplicant.income : 0);

  const adjustedLiabilities = {
    ...liabilities,
    otherMitigations: (liabilities.otherMitigations || 0) + reoLiabilitiesAddition + (coApplicant.enabled ? coApplicant.monthlyLiabilities * 12 : 0)
  };

  const debtService = calculateDebtService(globalCombinedIncome, adjustedLiabilities);
  
  // Re-compute LTV with updated internal amortization reference tracking
  const currentSyncedCollateral = { ...collateral, amortization };
  const ltvCalc = computeLtv(currentSyncedCollateral);
  
  const staticTaxpayerName = analysis?.payload.taxpayer_name ?? DEFAULT_TAXPAYER;
  const activeTaxpayerName = applications.find(a => a.id === activeAppId)?.taxpayerName || staticTaxpayerName;

  const toggleAppSelectionForDeletion = (id: string) => {
    if (selectedAppIdsForDeletion.includes(id)) {
      setSelectedAppIdsForDeletion(selectedAppIdsForDeletion.filter(i => i !== id));
    } else {
      setSelectedAppIdsForDeletion([...selectedAppIdsForDeletion, id]);
    }
  };

  return (
    <div className="min-h-screen bg-background font-display text-foreground antialiased">
      <GlobalHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      <SubHeader applicationNumber={activeAppId} taxpayerName={activeTaxpayerName} />
      
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        
        {/* Core Global Action Controls */}
        <div className="flex items-center justify-between bg-card border border-border p-3 rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNewApplication}
              className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
            >
              <FilePlus className="h-3.5 w-3.5 text-emerald-600" /> Start New Application File
            </button>
            {selectedAppIdsForDeletion.length > 0 && (
              <button
                onClick={handleBatchDeleteSelected}
                className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" /> Purge Selected Files ({selectedAppIdsForDeletion.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSave}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs"
            >
              <Save className="h-3.5 w-3.5" /> Save Application Context
            </button>
          </div>
        </div>

        {activeTab === "Adjudication" && (
          <>
            {/* Dynamic Product Execution Parameters Row */}
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" /> Underwriting Product Parameters
                </h3>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded">
                    LTV {ltvCalc.ltv}%
                  </span>
                  <span className="bg-secondary border border-border text-muted-foreground text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded">
                    {ltvCalc.highRatio ? "High Ratio" : "Conventional"} · {amortization}-YR AM ELIGIBLE
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1.5">Amortization (Years)</label>
                  <div className="space-y-1.5">
                    <input 
                      type="number"
                      min="1"
                      max="40"
                      value={amortization || ""}
                      onChange={(e) => setAmortization(Number(e.target.value))}
                      placeholder="e.g. 18"
                      className="w-full bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500 font-mono font-bold text-foreground"
                    />
                    <div className="flex gap-1">
                      {[15, 25, 30].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAmortization(val)}
                          className={`text-[9.5px] font-mono px-1.5 py-0.5 border rounded transition-all ${amortization === val ? "bg-secondary border-muted-foreground text-foreground font-bold" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                        >
                          {val}Y
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1.5">Rate Program Structure</label>
                  <div className="grid grid-cols-2 gap-1 bg-secondary/50 p-1 rounded border border-border">
                    <button onClick={() => setRateType("fixed")} className={`py-1 text-center font-semibold rounded transition-all ${rateType === "fixed" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"}`}>Fixed</button>
                    <button onClick={() => setRateType("variable")} className={`py-1 text-center font-semibold rounded transition-all ${rateType === "variable" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"}`}>Variable</button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-muted-foreground font-medium mb-1.5">Contract Commit Term</label>
                  <div className="flex flex-wrap gap-1 bg-secondary/50 p-1 rounded border border-border">
                    {["6m", "1y", "2y", "3y", "4y", "5y", "6y", "7y"].map((term) => (
                      <button key={term} onClick={() => setSelectedTerm(term)} className={`flex-1 py-1 text-center font-mono font-bold text-[11px] rounded uppercase transition-all ${selectedTerm === term ? "bg-emerald-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>{term}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Multi-Applicant Control Bridge */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Co-Applicant Qualification Engine</h3>
                    <p className="text-[11px] text-muted-foreground">Toggle to calculate layered liabilities and mismatched asset-to-title marital applications.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={coApplicant.enabled} onChange={(e) => setCoApplicant({ ...coApplicant, enabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              {coApplicant.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs bg-secondary/10 p-3 rounded-lg border border-border">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Co-Applicant Full Name</label>
                    <input type="text" value={coApplicant.name} onChange={(e) => setCoApplicant({ ...coApplicant, name: e.target.value })} className="w-full bg-background border border-border rounded p-1.5" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Annual Qualifying Income ($)</label>
                    <input type="number" value={coApplicant.income || ""} onChange={(e) => setCoApplicant({ ...coApplicant, income: Number(e.target.value) })} className="w-full bg-background border border-border rounded p-1.5 font-mono text-emerald-600 font-bold" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Independent Mo. Liabilities ($)</label>
                    <input type="number" value={coApplicant.monthlyLiabilities || ""} onChange={(e) => setCoApplicant({ ...coApplicant, monthlyLiabilities: Number(e.target.value) })} className="w-full bg-background border border-border rounded p-1.5 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Employment Tracking</label>
                    <select value={coApplicant.employmentType} onChange={(e) => setCoApplicant({ ...coApplicant, employmentType: e.target.value as any })} className="w-full bg-background border border-border rounded p-1.5">
                      <option value="salaried">Salaried Position</option>
                      <option value="self-employed">Self-Employed Matrix</option>
                      <option value="contract">Contractor / T4A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Registered On Title / Deed?</label>
                    <div className="grid grid-cols-2 gap-1 bg-background p-0.5 rounded border border-border mt-0.5">
                      <button onClick={() => setCoApplicant({ ...coApplicant, onTitle: true })} className={`py-1 text-center font-medium rounded text-[11px] ${coApplicant.onTitle ? "bg-emerald-600 text-white" : "text-muted-foreground"}`}>Yes</button>
                      <button onClick={() => setCoApplicant({ ...coApplicant, onTitle: false })} className={`py-1 text-center font-medium rounded text-[11px] ${!coApplicant.onTitle ? "bg-amber-600 text-white" : "text-muted-foreground"}`}>No (Title Split)</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-hidden">
              {LenderManagement ? <LenderManagement /> : <div className="p-3 border border-red-200 bg-red-50 text-red-700 text-xs rounded-lg">Lender Core Module Component Unresolved.</div>}
            </div>

            {/* Real Estate Owned (REO) Portfolio Control Engine */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Real Estate Owned (REO) Schedule</h3>
                  <p className="text-[11px] text-muted-foreground">Manage multi-property portfolio carry costs and matching multi-lender rental wash metrics.</p>
                </div>
                <button onClick={addProperty} className="flex items-center gap-1.5 bg-secondary text-foreground border border-border hover:bg-secondary/80 px-2.5 py-1 text-xs font-medium rounded transition-all">
                  <PlusCircle className="h-3.5 w-3.5 text-emerald-600" /> Add Portfolio Asset
                </button>
              </div>

              {additionalProperties.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground font-mono">No secondary holdings listed on file. Net global calculations operating on base criteria inputs.</div>
              ) : (
                <div className="space-y-4">
                  {additionalProperties.map((prop) => (
                    <div key={prop.id} className="p-4 bg-secondary/20 border border-border rounded-lg grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-xs relative group">
                      <div className="md:col-span-3">
                        <label className="block text-[11px] text-muted-foreground font-medium mb-1">Asset Street Address</label>
                        <input type="text" placeholder="e.g. 88 King St West, Toronto" value={prop.address} onChange={(e) => updateProperty(prop.id, { address: e.target.value })} className="w-full bg-background border border-border rounded px-2 py-1 focus:outline-none focus:border-emerald-500" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground font-medium mb-1">Asset Usage</label>
                        <select value={prop.usage} onChange={(e) => updateProperty(prop.id, { usage: e.target.value as any })} className="w-full bg-background border border-border rounded p-1 focus:outline-none">
                          <option value="rental">Rental Holding</option>
                          <option value="second-home">Secondary Home</option>
                          <option value="warm-vacant">Vacant Asset</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground font-medium mb-1">Financing Status</label>
                        <select value={prop.status} onChange={(e) => updateProperty(prop.id, { status: e.target.value as any })} className="w-full bg-background border border-border rounded p-1 focus:outline-none">
                          <option value="mortgaged">Mortgaged</option>
                          <option value="free-and-clear">Free & Clear</option>
                        </select>
                      </div>
                      
                      {prop.status === "mortgaged" && (
                        <div className="md:col-span-2">
                          <label className="block text-[11px] text-muted-foreground font-medium mb-1">Mo. Mortgage ($)</label>
                          <input type="number" value={prop.mortgagePayment || ""} onChange={(e) => updateProperty(prop.id, { mortgagePayment: Number(e.target.value) })} className="w-full bg-background border border-border rounded px-2 py-1 font-mono" />
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground font-medium mb-1">Mo. Taxes/Heat ($)</label>
                        <input type="number" value={prop.propertyTax || ""} onChange={(e) => updateProperty(prop.id, { propertyTax: Number(e.target.value) })} className="w-full bg-background border border-border rounded px-2 py-1 font-mono" />
                      </div>

                      {prop.usage === "rental" && (
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/60 pt-3 mt-1 bg-background/40 p-2.5 rounded">
                          <div>
                            <label className="block text-[11px] text-muted-foreground font-medium mb-1">Gross Monthly Rent ($)</label>
                            <input type="number" value={prop.grossRentalIncome || ""} onChange={(e) => updateProperty(prop.id, { grossRentalIncome: Number(e.target.value) })} className="w-full bg-background border border-border rounded px-2 py-1 font-mono text-emerald-600 font-bold" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground font-medium mb-1">Calculation Offset Strategy</label>
                            <select value={prop.rentalCalculationMethod} onChange={(e) => updateProperty(prop.id, { rentalCalculationMethod: e.target.value as any
