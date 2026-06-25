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
