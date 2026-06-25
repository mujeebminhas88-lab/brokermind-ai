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
        {LenderManagement ? <LenderManagement /> : <div className="p-4 border border-red-200 bg-red-50 text-red-700 text-xs rounded-lg">LenderManagement component failed to import correctly.</div>}
        
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
        
        <TrendingDown className="hidden" />
        <Receipt className="hidden" />
        <Hash className="hidden" />
        <User className="hidden" />
        <Calendar className="hidden" />
        <DollarSign className="hidden" />
        <X className="hidden" />
        
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

/* ────────────────────────── AUXILIARY WORKSPACE SUBCOMPONENTS ────────────────────────── */

function PaneHeader({
  icon,
  kicker,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
}) {
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

function Field({ icon, label, value, mono, accent }: { icon: React.ReactNode; label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border border-border bg-secondary/20 p-2 text-[11.5px]">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`${mono ? "font-mono" : ""} ${accent ? "font-bold text-emerald-600" : "font-semibold"}`}>{value}</span>
    </div>
  );
}

function ReconRow({ doc, val, status, tone, delta, onClick }: { doc: string; val: string; status: string; tone?: "ok" | "warn"; delta?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between py-1.5 border-b border-border text-[11px] ${onClick ? "cursor-pointer hover:bg-secondary/30" : ""}`}>
      <span className="text-muted-foreground">{doc}</span>
      <div className="flex items-center gap-2 font-mono">
        <span>{val}</span>
        <span className={`px-1.5 py-0.5 text-[9px] font-bold ${tone === "ok" ? "bg-emerald-100 text-emerald-800" : tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-secondary text-muted-foreground"}`}>
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
        <div className="flex justify-between"><span>GDS / TDS</span><span className="font-mono">{debtService.gds}% / {debtService.tds}%</span></div>
        <div className="flex justify-between"><span>CRA Verification Status</span><span className={`font-bold ${craCleared ? "text-emerald-600" : "text-amber-600"}`}>{craCleared ? "Cleared" : "Pending Arrears Match"}</span></div>
      </div>
    </div>
  );
}

function ConditionsPanel({ conditions, setConditions, incomeOverride, analysis }: any) {
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

function TopBar() {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="font-bold tracking-tight text-sm">BrokerMindAI</div>
        <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded uppercase">Workspace Live</span>
      </div>
      <div className="flex items-center gap-4 text-muted-foreground">
        <Search className="h-4 w-4" />
        <Bell className="h-4 w-4" />
        <Settings className="h-4 w-4" />
      </div>
    </header>
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
        <p className="text-xs text-muted-foreground">Forensic Application Verification Pipeline</p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-500" /> <span className="font-mono">System Nominal</span></div>
        <div className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-muted-foreground" /> <span className="font-mono">v1.2.4-Production</span></div>
      </div>
    </div>
  );
}

function DocumentLens({ incomeOverride, setIncomeOverride }: any) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col h-full border border-border rounded-xl shadow-sm overflow-hidden bg-card">
      <PaneHeader icon={<FileText className="h-4 w-4" />} kicker="WORKSPACE MODULE" title="Forensic Document Lens" subtitle="CRA Direct Stream Integration" />
      <div className="p-4 flex-1 space-y-4">
        <div className="border border-border bg-secondary/10 p-3 rounded-lg space-y-2">
          <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extracted Object Meta</span><button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-muted-foreground hover:text-foreground transition-all">{copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
          <div className="space-y-1 text-xs">
            <Row label="CRA Document Hash ID" value="sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" />
            <Row label="Taxation Period Verified" value="Tax Year 2024" />
            <Row label="Processing Architecture" value="Claude-3-5-Sonnet-Scraper" />
          </div>
        </div>
        <div className="border border-border p-3 rounded-lg space-y-2 bg-card">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CRA Line Reconciliation</span>
          <div className="divide-y divide-border">
            <ReconRow doc="Line 15000 · Total Income" val="$94,500.00" status="Match Verified" tone="ok" />
            <ReconRow doc="Line 10100 · Employment Income" val="$91,200.00" status="Match Verified" tone="ok" />
            <ReconRow doc="Line 23600 · Net Income" val="$88,410.00" status="Delta Flag" tone="warn" delta="-$2,790" />
            <ReconRow doc="Line 43700 · Total Tax Deducted" val="$19,450.00" status="Match Verified" tone="ok" />
          </div>
        </div>
      </div>
    </div>
  );
}
