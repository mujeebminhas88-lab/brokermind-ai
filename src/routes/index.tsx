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
import type { NoaAnalysis } from "@/utils/noaParser";

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
  component: Dashboard,
});

const baselineConditions: ConditionItem[] = [
  { id: "INC-01", category: "Income", title: "Verify Line 15000 Total Income", satisfied: false },
  { id: "INC-04", category: "Income", title: "CRA Arrears Proof of Payment", satisfied: false },
  { id: "PROP-01", category: "Property", title: "Appraisal Report Valuation Match", satisfied: false }
];

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

  useEffect(() => {
    const saved = localStorage.getItem("brokermind_applications_pipeline");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setApplications(parsed);
          setActiveAppId(parsed[0].id);
        }
      } catch (e) {
        console.error("Hydration error:", e);
      }
    }
  }, []);

  const currentApp = applications.find(app => app.id === activeAppId) || null;

  const updateCurrentApp = (fields: Partial<ApplicationRecord>) => {
    if (!currentApp) return;
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
    const remainingList = applications.filter(app => !selectedAppIdsForDeletion.includes(app.id));
    
    if (remainingList.length === 0) {
      localStorage.removeItem("brokermind_applications_pipeline");
      setApplications([]);
      setActiveAppId("");
    } else {
      setApplications(remainingList);
      localStorage.setItem("brokermind_applications_pipeline", JSON.stringify(remainingList));
      if (selectedAppIdsForDeletion.includes(activeAppId)) {
        setActiveAppId(remainingList[0].id);
      }
    }
    setSelectedAppIdsForDeletion([]);
  };

  if (!currentApp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-10 text-center space-y-4">
        <p className="text-muted-foreground">No active application context found.</p>
        <button onClick={handleCreateNewApplication} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Create First Application
        </button>
      </div>
    );
  }

  const baseQualifyingIncome = currentApp.analysis?.payload.line_15000_total_income ?? 94500;
  const debtService = calculateDebtService(baseQualifyingIncome, currentApp.liabilities);
  const ltvCalc = computeLtv({ ...currentApp.collateral, amortization: currentApp.amortization });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-2 bg-card p-3 rounded-xl border">
          <button onClick={handleCreateNewApplication} className="text-xs bg-secondary px-3 py-1.5 rounded-lg font-semibold">Add New</button>
          <button onClick={handleBatchDeleteSelected} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-semibold">Delete Selected</button>
        </div>
        
        <div className="space-y-4">
          <input 
            type="text"
            value={currentApp.taxpayerName}
            onChange={(e) => updateCurrentApp({ taxpayerName: e.target.value })}
            className="text-lg font-bold bg-transparent w-full border-b"
          />
          
          <div className="grid grid-cols-4 gap-4">
            <input 
              type="number"
              value={currentApp.amortization}
              onChange={(e) => updateCurrentApp({ amortization: Number(e.target.value) })}
              className="p-2 border rounded"
            />
          </div>

          <CollateralPanel 
            state={currentApp.collateral} 
            setState={(next) => updateCurrentApp({ collateral: typeof next === "function" ? next(currentApp.collateral) : next })} 
            onFlagsChange={() => {}} 
            amortizationOverride={currentApp.amortization} 
          />
        </div>
      </div>
    </div>
  );
}

function GlobalHeader({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (v: string) => void }) {
  return (
    <header className="border-b p-4 flex items-center justify-between">
      <span className="font-bold">BrokerMind AI</span>
      <nav className="flex gap-4">
        {["Pipeline", "Adjudication", "Conditions", "Compliance", "Reports"].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? "text-emerald-600 font-bold" : ""}>{tab}</button>
        ))}
      </nav>
    </header>
  );
}
