import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import React from "react";
import {
  FileText,
  Building2,
  Users,
  Sliders,
  Save,
  FilePlus,
  Trash2,
  Search,
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import { NoaUploader } from "@/components/NoaUploader";
import { SandboxPanel } from "@/components/SandboxPanel";
import { LiabilitiesPanel, DEFAULT_LIABILITIES, type LiabilityInputs } from "@/components/LiabilitiesPanel";
import { CollateralPanel, DEFAULT_COLLATERAL, computeLtv, type CollateralState } from "@/components/CollateralPanel";
import { EmploymentIntakePanel, DEFAULT_EMPLOYMENT, type EmploymentState } from "@/components/EmploymentIntakePanel";
import { LenderManagement } from "@/components/LenderManagement";
import { calculateDebtService } from "@/utils/debtService";
import type { NoaAnalysis, RiskFlag } from "@/utils/noaParser";

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

interface ConditionItem {
  id: string;
  category: string;
  title: string;
  satisfied: boolean;
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
  employment: EmploymentState;
  conditions: ConditionItem[];
  coApplicant: CoApplicantState;
  analysis: NoaAnalysis | null;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrokerMindAI — Underwriter Adjudication Workspace" },
      {
        name: "description",
        content: "Executive mortgage adjudication dashboard with dynamic multi-file encapsulation mechanics.",
      },
    ],
  }),
  component: Dashboard,
});

const baselineConditions: ConditionItem[] = [
  { id: "INC-01", category: "Income", title: "Verify Line 15000 Total Income", satisfied: false },
  { id: "INC-04", category: "Income", title: "CRA Arrears Proof of Payment", satisfied: false },
  { id: "PROP-01", category: "Property", title: "Appraisal Report Valuation Match", satisfied: false }
];

const DEFAULT_APP_ID = "APP-2025-08842";
const DEFAULT_QUALIFYING_INCOME = 94500;

// Base configuration template used to securely stand up pristine new empty files
const createBlankRecord = (id: string, name: string): ApplicationRecord => ({
  id,
  taxpayerName: name,
  amortization: 25,
  rateType: "fixed",
  selectedTerm: "5y",
  additionalProperties: [],
  liabilities: { ...DEFAULT_LIABILITIES },
  collateral: { ...DEFAULT_COLLATERAL },
  employment: { ...DEFAULT_EMPLOYMENT },
  conditions: baselineConditions.map(c => ({ ...c })),
  coApplicant: { enabled: false, name: "", onTitle: false, income: 0, employmentType: "salaried", monthlyLiabilities: 0 },
  analysis: null
});

function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("Adjudication");
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [activeAppId, setActiveAppId] = useState<string>("");
  const [selectedAppIdsForDeletion, setSelectedAppIdsForDeletion] = useState<string[]>([]);
  const [sandbox, setSandbox] = useState(false);

  // Hydrate strictly from client store or provision primary fallback cleanly
  useEffect(() => {
    const saved = localStorage.getItem("brokermind_applications_pipeline");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setApplications(parsed);
          setActiveAppId(parsed[0].id);
          return;
        }
      } catch (e) {
        console.error("Pipeline breakdown tracking state initialization hydration", e);
      }
    }
    const seedRecord = createBlankRecord(DEFAULT_APP_ID, "Mujeeb Minhas");
    // Seed standard mock starting data for the default template safely
    seedRecord.conditions[0].satisfied = true; 
    setApplications([seedRecord]);
    setActiveAppId(DEFAULT_APP_ID);
  }, []);

  // Isolate current runtime entity context
  const currentApp = applications.find(app => app.id === activeAppId) || applications[0];

  if (!currentApp) {
    return <div className="p-20 text-center font-mono text-xs">Awaiting Workspace Matrix Initialization...</div>;
  }

  // Unified dynamic inline update engine mapped straight to array index coordinates
  const updateCurrentApp = (fields: Partial<ApplicationRecord>) => {
    setApplications(prev => prev.map(app => app.id === activeAppId ? { ...app, ...fields } : app));
  };

  const handleCreateNewApplication = () => {
    const generatedId = `APP-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const newRecord = createBlankRecord(generatedId, "New Primary Applicant");
    
    const updatedPipeline = [...applications, newRecord];
    setApplications(updatedPipeline);
    localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(updatedPipeline));
    setActiveAppId(generatedId);
  };

  const handleBatchDeleteSelected = () => {
    if (selectedAppIdsForDeletion.length === 0) return;

    if (confirm(`Acknowledge hard deletion request of ${selectedAppIdsForDeletion.length} processing records?`)) {
      const remainingList = applications.filter(app => !selectedAppIdsForDeletion.includes(app.id));
      
      if (remainingList.length === 0) {
        const resetRecord = createBlankRecord(DEFAULT_APP_ID, "New Primary Applicant");
        setApplications([resetRecord]);
        setActiveAppId(DEFAULT_APP_ID);
        localStorage.setItem("brokermind_applications_pipeline", JSON.stringify([resetRecord]));
      } else {
        setApplications(remainingList);
        localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(remainingList));
        if (selectedAppIdsForDeletion.includes(activeAppId)) {
          setActiveAppId(remainingList[0].id);
        }
      }
      setSelectedAppIdsForDeletion([]);
    }
  };

  const handleManualSave = () => {
    localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(applications));
    alert("Application pipeline state successfully synchronized to persistent browser storage.");
  };

  // Real Real-time dynamic compliance tracking checks
  const amlFlags: any[] = [];
  if (currentApp.coApplicant.enabled && !currentApp.coApplicant.onTitle && currentApp.coApplicant.income > 100000) {
    amlFlags.push({
      id: "AML-01",
      metric: "Layered Unregistered Asset Structuring",
      risk: "medium",
      description: "Co-applicant providing significant income yield metrics without being attached to the collateral registration asset deed."
    });
  }
  if (currentApp.additionalProperties.some(p => p.grossRentalIncome > 6000 && p.status === "free-and-clear")) {
    amlFlags.push({
      id: "AML-02",
      metric: "High Yield Unverified Real Estate Cashflow",
      risk: "high",
      description: "Rental property assets displaying disproportionate cash distributions with no verification of underlying acquisition tracking."
    });
  }

  // Financial aggregation rules
  let rentalIncomeAddition = 0;
  let reoLiabilitiesAddition = 0;

  currentApp.additionalProperties.forEach(p => {
    const calculatedRent = p.grossRentalIncome * (p.rentalInclusionPercentage / 100);
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

  const baseQualifyingIncome = currentApp.analysis?.payload.line_15000_total_income ?? DEFAULT_QUALIFYING_INCOME;
  const globalCombinedIncome = baseQualifyingIncome + rentalIncomeAddition + (currentApp.coApplicant.enabled ? currentApp.coApplicant.income : 0);

  const adjustedLiabilities = {
    ...currentApp.liabilities,
    otherMitigations: (currentApp.liabilities.otherMitigations || 0) + reoLiabilitiesAddition + (currentApp.coApplicant.enabled ? currentApp.coApplicant.monthlyLiabilities * 12 : 0)
  };

  const debtService = calculateDebtService(globalCombinedIncome, adjustedLiabilities);
  const ltvCalc = computeLtv({ ...currentApp.collateral, amortization: currentApp.amortization });

  return (
    <div className="min-h-screen bg-background font-display text-foreground antialiased">
      <GlobalHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="border-b border-border bg-secondary/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 w-full max-w-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border shrink-0">{currentApp.id}</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <input 
              type="text"
              value={currentApp.taxpayerName}
              onChange={(e) => updateCurrentApp({ taxpayerName: e.target.value })}
              className="text-sm font-bold bg-transparent border-b border-transparent hover:border-border focus:border-emerald-500 focus:outline-none w-full py-0.5 text-foreground transition-all"
              placeholder="Enter Applicant Name..."
            />
          </div>
        </div>
      </div>
      
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        
        {/* Workflow Toolbar */}
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
          <button
            onClick={handleManualSave}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs"
          >
            <Save className="h-3.5 w-3.5" /> Save Application Context
          </button>
        </div>

        {activeTab === "Adjudication" && (
          <>
            {/* Underwriting Parameters Module */}
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
                    {ltvCalc.highRatio ? "High Ratio" : "Conventional"} · {currentApp.amortization}-YR AM ELIGIBLE
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
                      value={currentApp.amortization || ""}
                      onChange={(e) => updateCurrentApp({ amortization: Number(e.target.value) })}
                      className="w-full bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500 font-mono font-bold text-foreground"
                    />
                    <div className="flex gap-1">
                      {[15, 25, 30].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateCurrentApp({ amortization: val })}
                          className={`text-[9.5px] font-mono px-1.5 py-0.5 border rounded transition-all ${currentApp.amortization === val ? "bg-secondary border-muted-foreground text-foreground font-bold" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
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
                    <button onClick={() => updateCurrentApp({ rateType: "fixed" })} className={`py-1 text-center font-semibold rounded transition-all ${currentApp.rateType === "fixed" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"}`}>Fixed</button>
                    <button onClick={() => updateCurrentApp({ rateType: "variable" })} className={`py-1 text-center font-semibold rounded transition-all ${currentApp.rateType === "variable" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"}`}>Variable</button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-muted-foreground font-medium mb-1.5">Contract Commit Term</label>
                  <div className="flex flex-wrap gap-1 bg-secondary/50 p-1 rounded border border-border">
                    {["6m", "1y", "2y", "3y", "4y", "5y", "6y", "7y"].map((term) => (
                      <button key={term} onClick={() => updateCurrentApp({ selectedTerm: term })} className={`flex-1 py-1 text-center font-mono font-bold text-[11px] rounded uppercase transition-all ${currentApp.selectedTerm === term ? "bg-emerald-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>{term}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Co-Applicant Qualification View */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Co-Applicant Qualification Engine</h3>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={currentApp.coApplicant.enabled} onChange={(e) => updateCurrentApp({ coApplicant: { ...currentApp.coApplicant, enabled: e.target.checked } })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              {currentApp.coApplicant.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs bg-secondary/10 p-3 rounded-lg border border-border">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Co-Applicant Full Name</label>
                    <input type="text" value={currentApp.coApplicant.name} onChange={(e) => updateCurrentApp({ coApplicant: { ...currentApp.coApplicant, name: e.target.value } })} className="w-full bg-background border border-border rounded p-1.5" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Annual Income ($)</label>
                    <input type="number" value={currentApp.coApplicant.income || ""} onChange={(e) => updateCurrentApp({ coApplicant: { ...currentApp.coApplicant, income: Number(e.target.value) } })} className="w-full bg-background border border-border rounded p-1.5 font-mono text-emerald-600 font-bold" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Mo. Liabilities ($)</label>
                    <input type="number" value={currentApp.coApplicant.monthlyLiabilities || ""} onChange={(e) => updateCurrentApp({ coApplicant: { ...currentApp.coApplicant, monthlyLiabilities: Number(e.target.value) } })} className="w-full bg-background border border-border rounded p-1.5 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Employment Tracking</label>
                    <select value={currentApp.coApplicant.employmentType} onChange={(e) => updateCurrentApp({ coApplicant: { ...currentApp.coApplicant, employmentType: e.target.value as any } })} className="w-full bg-background border border-border rounded p-1.5">
                      <option value="salaried">Salaried Position</option>
                      <option value="self-employed">Self-Employed</option>
                      <option value="contract">Contractor / T4A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Registered On Title?</label>
                    <div className="grid grid-cols-2 gap-1 bg-background p-0.5 rounded border border-border mt-0.5">
                      <button onClick={() => updateCurrentApp({ coApplicant: { ...currentApp.coApplicant, onTitle: true } })} className={`py-1 text-center font-medium rounded text-[11px] ${currentApp.coApplicant.onTitle ? "bg-emerald-600 text-white" : "text-muted-foreground"}`}>Yes</button>
                      <button onClick={() => updateCurrentApp({ coApplicant: { ...currentApp.coApplicant, onTitle: false } })} className={`py-1 text-center font-medium rounded text-[11px] ${!currentApp.coApplicant.onTitle ? "bg-amber-600 text-white" : "text-muted-foreground"}`}>No</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <LenderManagement />

            {/* Portfolio Assets REO Panel */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Real Estate Owned (REO) Schedule</h3>
                </div>
                <button 
                  onClick={() => updateCurrentApp({
                    additionalProperties: [...currentApp.additionalProperties, {
                      id: crypto.randomUUID(), address: "", usage: "rental", status: "mortgaged", mortgagePayment: 0, propertyTax: 0, heatingCosts: 0, grossRentalIncome: 0, rentalCalculationMethod: "debt-service-offset", rentalInclusionPercentage: 50
                    }]
                  })} 
                  className="bg-secondary text-foreground border border-border hover:bg-secondary/80 px-2.5 py-1 text-xs font-medium rounded"
                >
                  + Add Portfolio Asset
                </button>
              </div>

              {currentApp.additionalProperties.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground font-mono">No secondary holdings listed on active file.</div>
              ) : (
                <div className="space-y-4">
                  {currentApp.additionalProperties.map((prop) => (
                    <div key={prop.id} className="p-4 bg-secondary/20 border border-border rounded-lg grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-xs relative">
                      <div className="md:col-span-3">
                        <label className="block text-[11px] text-muted-foreground mb-1">Street Address</label>
                        <input type="text" value={prop.address} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, address: e.target.value } : p) })} className="w-full bg-background border border-border rounded px-2 py-1" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground mb-1">Asset Usage</label>
                        <select value={prop.usage} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, usage: e.target.value as any } : p) })} className="w-full bg-background border border-border rounded p-1">
                          <option value="rental">Rental Holding</option>
                          <option value="second-home">Secondary Home</option>
                          <option value="vacant">Vacant Asset</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground mb-1">Financing Status</label>
                        <select value={prop.status} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, status: e.target.value as any } : p) })} className="w-full bg-background border border-border rounded p-1">
                          <option value="mortgaged">Mortgaged</option>
                          <option value="free-and-clear">Free & Clear</option>
                        </select>
                      </div>
                      {prop.status === "mortgaged" && (
                        <div className="md:col-span-2">
                          <label className="block text-[11px] text-muted-foreground mb-1">Mo. Mortgage ($)</label>
                          <input type="number" value={prop.mortgagePayment || ""} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, mortgagePayment: Number(e.target.value) } : p) })} className="w-full bg-background border border-border rounded px-2 py-1 font-mono" />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-muted-foreground mb-1">Mo. Taxes/Heat ($)</label>
                        <input type="number" value={prop.propertyTax || ""} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, propertyTax: Number(e.target.value) } : p) })} className="w-full bg-background border border-border rounded px-2 py-1 font-mono" />
                      </div>
                      <button onClick={() => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.filter(p => p.id !== prop.id) })} className="md:col-span-1 p-1.5 text-muted-foreground hover:text-red-500 text-right"><Trash2 className="h-4 w-4 inline" /></button>

                      {prop.usage === "rental" && (
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/60 pt-3 mt-1 bg-background/40 p-2.5 rounded">
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Gross Monthly Rent ($)</label>
                            <input type="number" value={prop.grossRentalIncome || ""} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, grossRentalIncome: Number(e.target.value) } : p) })} className="w-full bg-background border border-border rounded px-2 py-1 font-mono text-emerald-600 font-bold" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Offset Calculation Strategy</label>
                            <select value={prop.rentalCalculationMethod} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, rentalCalculationMethod: e.target.value as any } : p) })} className="w-full bg-background border border-border rounded p-1">
                              <option value="debt-service-offset">Rental Offset (TDS Deduction)</option>
                              <option value="gross-add-to-income">Add to Gross Income</option>
                            </select>
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span>Inclusion Ratio</span><span className="font-bold text-emerald-600">{prop.rentalInclusionPercentage}%</span>
                            </div>
                            <input type="range" min="0" max="100" step="5" value={prop.rentalInclusionPercentage} onChange={(e) => updateCurrentApp({ additionalProperties: currentApp.additionalProperties.map(p => p.id === prop.id ? { ...p, rentalInclusionPercentage: Number(e.target.value) } : p) })} className="w-full h-1.5 bg-border accent-emerald-600 cursor-pointer rounded-lg" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <CollateralPanel state={currentApp.collateral} setState={(next) => updateCurrentApp({ collateral: typeof next === "function" ? next(currentApp.collateral) : next })} onFlagsChange={() => {}} amortizationOverride={currentApp.amortization} />

            {sandbox ? (
              <SandboxPanel onAnalyzed={(res) => updateCurrentApp({ analysis: res })} onClear={() => updateCurrentApp({ analysis: null })} />
            ) : (
              <NoaUploader analysis={currentApp.analysis} analyzing={false} onAnalyzed={(res) => updateCurrentApp({ analysis: res })} onAnalyzingChange={() => {}} onClear={() => updateCurrentApp({ analysis: null })} />
            )}
            
            <LiabilitiesPanel liabilities={currentApp.liabilities} setLiabilities={(next) => updateCurrentApp({ liabilities: typeof next === "function" ? next(currentApp.liabilities) : next })} result={debtService} />
            <EmploymentIntakePanel state={currentApp.employment} setState={(next) => updateCurrentApp({ employment: typeof next === "function" ? next(currentApp.employment) : next })} onFlagsChange={() => {}} />
            
            <main className="grid grid-cols-12 gap-px bg-border">
              <section className="col-span-12 lg:col-span-5 bg-background p-4">
                <div className="border border-border rounded-xl p-4 bg-card space-y-4">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Document Ingestion Matrix</h4>
                  <div className="flex justify-between items-center py-2 border-b text-xs">
                    <span className="text-muted-foreground">Line 15000 Total Income</span>
                    <span className="font-mono font-bold">${baseQualifyingIncome.toLocaleString()}.00</span>
                  </div>
                </div>
              </section>
              <section className="col-span-12 lg:col-span-4 bg-background p-4">
                <div className="text-xs font-bold uppercase text-muted-foreground border-b pb-1 mb-2">Risk Scoring Matrix</div>
                <div className="bg-secondary/30 p-3 rounded-lg border text-xs space-y-1.5">
                  <div className="flex justify-between"><span>LTV Ratio</span><span className="font-mono font-bold">{ltvCalc.ltv}%</span></div>
                  <div className="flex justify-between"><span>GDS / TDS Metrics</span><span className="font-mono text-emerald-700 font-bold">{debtService.gds}% / {debtService.tds}%</span></div>
                </div>
              </section>
              <section className="col-span-12 lg:col-span-3 bg-background p-4 space-y-3">
                <div className="text-xs font-bold uppercase text-muted-foreground border-b pb-1">Automated Conditions Tracking</div>
                {currentApp.conditions.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 p-2 border bg-card rounded text-xs">
                    <input type="checkbox" checked={c.satisfied} onChange={(e) => updateCurrentApp({ conditions: currentApp.conditions.map(item => item.id === c.id ? { ...item, satisfied: e.target.checked } : item) })} className="mt-0.5 rounded" />
                    <div><span className="font-mono text-[10px] text-muted-foreground">{c.id}</span><p className="font-medium">{c.title}</p></div>
                  </div>
                ))}
              </section>
            </main>
          </>
        )}

        {activeTab === "Pipeline" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Pipeline File Ledger</h2>
            <div className="border border-border rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-secondary/60 border-b text-muted-foreground">
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
                    <tr key={app.id} className={`hover:bg-secondary/20 ${app.id === activeAppId ? "bg-emerald-500/5" : ""}`}>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={selectedAppIdsForDeletion.includes(app.id)} onChange={() => setSelectedAppIdsForDeletion(prev => prev.includes(app.id) ? prev.filter(i => i !== app.id) : [...prev, app.id])} className="rounded" />
                      </td>
                      <td className="p-3 font-bold text-emerald-600 cursor-pointer underline decoration-dotted" onClick={() => setActiveAppId(app.id)}>{app.id}</td>
                      <td className="p-3 font-sans text-foreground font-medium">{app.taxpayerName}</td>
                      <td className="p-3">{app.amortization} Years</td>
                      <td className="p-3 font-sans">{app.coApplicant.enabled ? "Assigned Borrower" : "None"}</td>
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
              {currentApp.conditions.map((c) => (
                <div key={c.id} className="p-4 border bg-secondary/10 rounded-xl flex items-start gap-3 text-xs">
                  <input type="checkbox" checked={c.satisfied} onChange={(e) => updateCurrentApp({ conditions: currentApp.conditions.map(item => item.id === c.id ? { ...item, satisfied: e.target.checked } : item) })} className="mt-0.5 rounded" />
                  <div><span className="font-mono text-[10px] text-muted-foreground">{c.id}</span><h4 className="font-semibold text-foreground text-sm mt-0.5">{c.title}</h4></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Compliance" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 font-mono text-xs">
            <h2 className="text-sm font-sans uppercase tracking-wider font-bold text-foreground">Anti-Fraud & AML Compliance Risk Ledger</h2>
            {amlFlags.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-sans">No anomalies flagged on active document processing context paths.</div>
            ) : (
              <div className="space-y-3">
                {amlFlags.map((flag) => (
                  <div key={flag.id} className={`p-4 border rounded-xl flex items-start gap-3 ${flag.risk === "high" ? "border-red-200 bg-red-50/10" : "border-amber-200 bg-amber-50/10"}`}>
                    <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${flag.risk === "high" ? "text-red-600" : "text-amber-600"}`} />
                    <div>
                      <span className="font-bold">{flag.id} · {flag.metric} ({flag.risk} Risk)</span>
                      <p className="font-sans text-muted-foreground mt-1">{flag.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Reports" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase text-foreground">Executive Deal Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 bg-secondary/30 border rounded-xl text-center">
                <div className="text-muted-foreground font-sans">GDS Metric Status</div>
                <div className="text-xl font-bold mt-1">{debtService.gds}%</div>
              </div>
              <div className="p-4 bg-secondary/30 border rounded-xl text-center">
                <div className="text-muted-foreground font-sans">TDS Metric Status</div>
                <div className="text-xl font-bold mt-1">{debtService.tds}%</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function GlobalHeader({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (v: string) => void }) {
  return (
    <header className="bg-card border-b border-border h-14 px-6 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-emerald-700 rounded flex items-center justify-center text-white font-bold text-xs">B</div>
          <span className="font-bold tracking-tight text-sm text-foreground">BrokerMind <span className="text-emerald-600">AI</span></span>
        </div>
        <nav className="hidden md:flex items-center gap-1 h-14">
          {["Pipeline", "Adjudication", "Conditions", "Compliance", "Reports"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`h-full px-4 text-xs font-semibold border-b-2 transition-all duration-150 ${activeTab === tab ? "border-emerald-600 text-emerald-600 bg-emerald-500/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{tab}</button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 max-w-sm w-full md:w-72 relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input type="text" placeholder="Search applications..." className="w-full bg-secondary/40 border border-border rounded-lg pl-8 pr-3 py-1.5 text-[11.5px] focus:outline-none" />
      </div>
    </header>
  );
}
