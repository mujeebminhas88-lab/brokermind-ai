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
  // --- Prime / A-side (11 Lenders) ---
  { id: "b2b", name: "B2B Bank", tier: "prime" },
  { id: "bmo", name: "BMO (Authorized Brokers Only)", tier: "prime" },
  { id: "cwb-optimum", name: "CWB Optimum Mortgage A", tier: "prime" },
  { id: "merix", name: "Merix Upfront", tier: "prime" },
  { id: "mcap-prime", name: "MCAP Prime", tier: "prime" },
  { id: "rfa-prime", name: "RFA Prime (Kraken)", tier: "prime" },
  { id: "rmg", name: "RMG Mortgages (FCX)", tier: "prime" },
  { id: "scotia", name: "Scotia Bank / Banque Scotia", tier: "prime" },
  { id: "td", name: "TD Canada Trust", tier: "prime" },
  { id: "meridian", name: "Meridian Credit Union Ltd", tier: "prime" },
  { id: "cibc", name: "CIBC", tier: "prime" },

  // --- Alternate / B Side (14 Lenders) ---
  { id: "alterna", name: "Alterna", tier: "alt" },
  { id: "community-trust", name: "Community Trust", tier: "alt" },
  { id: "cwb-optimum-alt", name: "CWB Optimum Mortgage Alt-A", tier: "alt" },
  { id: "extend-financial", name: "Extend Financial Inc.", tier: "alt" },
  { id: "first-ontario", name: "First Ontario Credit Union", tier: "alt" },
  { id: "homeequity-chip", name: "HomeEquity Bank CHIP Max", tier: "alt" },
  { id: "ic-savings", name: "IC Savings", tier: "alt" },
  { id: "oppono", name: "Oppono Lending Company", tier: "alt" },
  { id: "rfa-alternatives", name: "RFA Alternatives", tier: "alt" },
  { id: "union-capital", name: "Union Capital Lending", tier: "alt" },
  { id: "wyth", name: "Wyth Financials", tier: "alt" },
  { id: "alpha-omega", name: "Alpha and Omega Inc.", tier: "alt" },
  { id: "home-classic", name: "Home Trust Company Classic", tier: "alt" },
  { id: "wealth-one-alt", name: "Wealth One Bank of Canada", tier: "alt" },

  // --- Private / MIC (21 Lenders) ---
  { id: "advanced-mic", name: "Advanced MIC", tier: "private" },
  { id: "advantage-mortgage", name: "Advantage Mortgage Centre Inc.", tier: "private" },
  { id: "alta-west", name: "Alt- Alta West Capital", tier: "private" },
  { id: "aria-savings", name: "Aria Savings", tier: "private" },
  { id: "armada-mortgage", name: "Armada Mortgage", tier: "private" },
  { id: "atrium-mic", name: "Atrium Mortgage Invest. Corp.", tier: "private" },
  { id: "b2-capital", name: "B2 Capital Corp", tier: "private" },
  { id: "bankright-financial", name: "BankRight Financial Ltd.", tier: "private" },
  { id: "bedrock-group", name: "Bedrock Group", tier: "private" },
  { id: "birch-mountain", name: "Birch Mountain Group Ltd.", tier: "private" },
  { id: "blacksun-mic", name: "Blacksun MIC", tier: "private" },
  { id: "bloom-finance", name: "Bloom Finance Reverse Mortgage", tier: "private" },
  { id: "blossom-capital", name: "Blossom Capital", tier: "private" },
  { id: "bluebridge-mic", name: "Bluebridge MIC", tier: "private" },
  { id: "blueshore-financial", name: "BlueShore Financial CU", tier: "private" },
  { id: "bridgewater-bank", name: "Bridgewater Bank", tier: "private" },
  { id: "bronco-mortgages", name: "Bronco Mortgages Inc.", tier: "private" },
  { id: "brookstreet-mic", name: "Brookstreet MIC", tier: "private" },
  { id: "brunswick-cu", name: "Brunswick CU", tier: "private" },
  { id: "calvert-home", name: "Calvert Home Mortgage Inv Corp", tier: "private" },
  { id: "cambridge-mic", name: "Cambridge MIC", tier: "private" },
  { id: "canadian-mortgages", name: "Canadian Mortgages Inc", tier: "private" },
  { id: "capital-direct", name: "Capital Direct Lending Corp", tier: "private" },
  { id: "capital-express", name: "Capital Express", tier: "private" },
  { id: "new-haven", name: "New Haven Lending", tier: "private" },
  { id: "gingko", name: "Gingko", tier: "private" },
  { id: "hosper", name: "Hosper Lending", tier: "private" },
  { id: "vault", name: "Vault", tier: "private" },
  { id: "resco", name: "Resco", tier: "private" }
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

  const currentTierLenders = lenders
    .filter(item => item.tier === activeTier)
    .sort((a, b) => a.name.localeCompare(b.name));

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
              {currentTierLenders.map((lender, idx) => (
                <option key={`${lender.id}-${idx}`} value={lender.id}>
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
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">03 · Automated Conditions Automated Conditions</div>
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
