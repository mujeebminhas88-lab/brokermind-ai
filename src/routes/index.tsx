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
          collateral,
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
        setActiveAppId(DEFAULT_APP_NUMBER);
        localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(DEFAULT_RECORDS));
      } else {
        setApplications(remainingList);
        if (selectedAppIdsForDeletion.includes(activeAppId)) {
          setActiveAppId(remainingList[0].id);
        }
        localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(remainingList));
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
  const ltvCalc = computeLtv(collateral);
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
                            <select value={prop.rentalCalculationMethod} onChange={(e) => updateProperty(prop.id, { rentalCalculationMethod: e.target.value as any })} className="w-full bg-background border border-border rounded p-1 focus:outline-none">
                              <option value="debt-service-offset">Rental Offset (TDS Matrix Deduction)</option>
                              <option value="gross-add-to-income">Add Directly to Gross Qualification</option>
                            </select>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-[11px] text-muted-foreground font-medium flex items-center gap-1"><Sliders className="h-3 w-3 text-emerald-600" /> Inclusion Ratio</label>
                              <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{prop.rentalInclusionPercentage}%</span>
                            </div>
                            <input type="range" min="0" max="100" step="5" value={prop.rentalInclusionPercentage} onChange={(e) => updateProperty(prop.id, { rentalInclusionPercentage: Number(e.target.value) })} className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-emerald-600 mt-2" />
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute top-2 right-2 md:relative md:top-auto md:right-auto md:col-span-1 text-right">
                        <button onClick={() => removeProperty(prop.id)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded border border-transparent hover:border-border transition-all"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Injected synced collateral layout block */}
            <CollateralPanel state={collateral} setState={setCollateral} onFlagsChange={setCollateralFlags} amortizationOverride={amortization} />

            {sandbox ? (
              <SandboxPanel onAnalyzed={setAnalysis} onClear={() => setAnalysis(null)} />
            ) : (
              <NoaUploader analysis={analysis} analyzing={analyzing} onAnalyzed={setAnalysis} onAnalyzingChange={setAnalyzing} onClear={() => setAnalysis(null)} />
            )}
            
            <LiabilitiesPanel liabilities={liabilities} setLiabilities={setLiabilities} result={debtService} />
            <EmploymentIntakePanel state={employment} setState={setEmployment} onFlagsChange={setEmploymentFlags} />
            
            <main className="grid grid-cols-12 gap-px bg-border" style={{ minHeight: "calc(100vh - 168px)" }}>
              <section className="col-span-12 lg:col-span-5 bg-background overflow-hidden">
                <DocumentLens />
              </section>
              <section className="col-span-12 lg:col-span-4 bg-background overflow-hidden relative">
                <ScoringMatrix ltv={ltvCalc.ltv} highRatio={ltvCalc.highRatio} debtService={debtService} />
              </section>
              <section className="col-span-12 lg:col-span-3 bg-background overflow-hidden relative">
                <ConditionsPanel conditions={conditions} setConditions={setConditions} />
              </section>
            </main>
          </>
        )}

        {activeTab === "Pipeline" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Pipeline File Ledger</h2>
            <div className="border border-border rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-secondary/60 border-b border-border text-muted-foreground font-sans">
                  <tr>
                    <th className="p-3 w-10 text-center">Select</th>
                    <th className="p-3">Application ID</th>
                    <th className="p-3">Borrower Name</th>
                    <th className="p-3">Amortization Stream</th>
                    <th className="p-3">Co-Applicant Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((app) => (
                    <tr 
                      key={app.id} 
                      className={`hover:bg-secondary/20 transition-colors ${app.id === activeAppId ? "bg-emerald-500/5" : ""}`}
                    >
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedAppIdsForDeletion.includes(app.id)} 
                          onChange={() => toggleAppSelectionForDeletion(app.id)}
                          className="rounded border-border text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td 
                        className="p-3 font-bold text-emerald-600 cursor-pointer underline decoration-dotted"
                        onClick={() => setActiveAppId(app.id)}
                      >
                        {app.id}
                      </td>
                      <td className="p-3 font-sans text-foreground font-medium">{app.id === DEFAULT_APP_NUMBER ? activeTaxpayerName : app.taxpayerName}</td>
                      <td className="p-3">{app.id === activeAppId ? amortization : app.amortization} Years</td>
                      <td className="p-3 font-sans">{(app.id === activeAppId ? coApplicant.enabled : app.coApplicant.enabled) ? "Assigned Spouse" : "None Assigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "Conditions" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Conditions Hub</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {conditions.map((c) => (
                <div key={c.id} className="p-4 border border-border bg-secondary/10 rounded-xl flex items-start gap-3 text-xs">
                  <input type="checkbox" checked={c.satisfied} onChange={(e) => setConditions(conditions.map(item => item.id === c.id ? { ...item, satisfied: e.target.checked } : item))} className="mt-0.5 rounded" />
                  <div>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">{c.id}</span>
                    <h4 className="font-semibold text-foreground text-sm mt-0.5">{c.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Compliance" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 font-mono text-xs">
            <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-foreground">Anti-Fraud & AML Compliance Risk Ledger</h2>
            <p className="text-xs font-sans text-muted-foreground">Real-time threat monitoring checks scanning documentation feeds for structured deployment profiles or asset misalignments.</p>
            
            {amlFlags.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-sans">
                No active anti-money laundering variances or structuring thresholds triggered inside document processing streams.
              </div>
            ) : (
              <div className="space-y-3">
                {amlFlags.map((flag) => (
                  <div key={flag.id} className={`p-4 border rounded-xl flex items-start gap-3 bg-card ${flag.risk === "high" ? "border-red-200 bg-red-50/10" : "border-amber-200 bg-amber-50/10"}`}>
                    <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${flag.risk === "high" ? "text-red-600" : "text-amber-600"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{flag.id} · {flag.metric}</span>
                        <span className={`text-[10px] uppercase font-sans font-bold px-1.5 py-0.5 rounded ${flag.risk === "high" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                          {flag.risk} Severity Risk
                        </span>
                      </div>
                      <p className="font-sans text-muted-foreground mt-1 text-[11.5px]">{flag.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-secondary/30 rounded-lg border border-border space-y-2 mt-4">
              <div className="flex justify-between font-sans">
                <span>Co-Applicant Marital Title Asset Risk Match</span>
                <span className={coApplicant.enabled && !coApplicant.onTitle ? "text-amber-600 font-mono font-bold" : "text-emerald-600 font-mono font-bold"}>
                  {coApplicant.enabled && !coApplicant.onTitle ? "[SPLIT TITLE WARNING FLAG]" : "[NOMINAL PASS]"}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Reports" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Executive Deal Analytics Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-center">
              <div className="p-4 bg-secondary/30 border border-border rounded-xl">
                <div className="text-muted-foreground font-sans text-[11px] mb-1">Calculated GDS Ratio</div>
                <div className="text-xl font-bold text-foreground">{debtService.gds}%</div>
              </div>
              <div className="p-4 bg-secondary/30 border border-border rounded-xl">
                <div className="text-muted-foreground font-sans text-[11px] mb-1">Calculated TDS Ratio</div>
                <div className="text-xl font-bold text-foreground">{debtService.tds}%</div>
              </div>
              <div className="p-4 bg-secondary/30 border border-border rounded-xl">
                <div className="text-muted-foreground font-sans text-[11px] mb-1">Amortization Stream Assignment</div>
                <div className="text-xl font-bold text-emerald-600">{amortization} Years</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ────────────────────────── UTILITY WORKSPACE SUBCOMPONENTS ────────────────────────── */

function GlobalHeader({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (v: string) => void }) {
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
          {["Pipeline", "Adjudication", "Conditions", "Compliance", "Reports"].map((tab) => (
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
          <input type="text" placeholder="Search applications..." className="w-full bg-secondary/40 border border-border rounded-lg pl-8 pr-3 py-1.5 text-[11.5px] focus:outline-none" />
        </div>
      </div>
    </header>
  );
}

function PaneHeader({ icon, kicker, title }: { icon: React.ReactNode; kicker: string; title: string }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground">{kicker}</span>
          <h2 className="text-[12.5px] font-bold tracking-tight truncate text-foreground">{title}</h2>
        </div>
      </div>
    </div>
  );
}

function ReconRow({ doc, val, status, tone }: { doc: string; val: string; status: string; tone?: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border text-[11px]">
      <span className="text-muted-foreground">{doc}</span>
      <div className="flex items-center gap-2 font-mono">
        <span>{val}</span>
        <span className={`px-1.5 py-0.5 text-[9px] font-bold ${tone === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status}</span>
      </div>
    </div>
  );
}

function ScoringMatrix({ ltv, highRatio, debtService }: any) {
  return (
    <div className="flex h-full flex-col p-4 space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">02 · Risk Scoring Matrix</div>
      <div className="bg-secondary/30 p-3 rounded-lg border border-border space-y-2 text-xs">
        <div className="flex justify-between"><span>LTV Ratio</span><span className="font-mono font-bold">{ltv}% ({highRatio ? "High Ratio" : "Conventional"})</span></div>
        <div className="flex justify-between"><span>Adjusted GDS / TDS</span><span className="font-mono text-emerald-700 font-bold">{debtService.gds}% / {debtService.tds}%</span></div>
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
            <input type="checkbox" checked={c.satisfied} onChange={(e) => setConditions(conditions.map((item: any) => item.id === c.id ? { ...item, satisfied: e.target.checked } : item))} className="mt-0.5 rounded" />
            <div>
              <div className="font-mono text-[10px] font-bold text-muted-foreground">{c.id}</div>
              <div className="font-medium">{c.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentLens() {
  return (
    <div className="flex flex-col h-full border border-border rounded-xl shadow-sm overflow-hidden bg-card">
      <PaneHeader icon={<FileText className="h-4 w-4" />} kicker="WORKSPACE MODULE" title="Forensic Document Lens" />
      <div className="p-4 flex-1 space-y-4">
        <div className="border border-border p-3 rounded-lg space-y-2 bg-card">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CRA Line Reconciliation</span>
          <div className="divide-y divide-border">
            <ReconRow doc="Line 15000 · Total Income" val="$94,500.00" status="Match Verified" tone="ok" />
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
    </div>
  );
}
