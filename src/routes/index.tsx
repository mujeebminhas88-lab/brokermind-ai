import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";

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
  const craCleared = conditions[0].satisfied;

  return (
    <div className="min-h-screen bg-background font-display text-foreground antialiased">
      <TopBar />
      <SubHeader />
      <main className="grid grid-cols-12 gap-px bg-border" style={{ height: "calc(100vh - 96px)" }}>
        <section className="col-span-12 lg:col-span-5 bg-background overflow-hidden">
          <DocumentLens />
        </section>
        <section className="col-span-12 lg:col-span-4 bg-background overflow-hidden">
          <ScoringMatrix craCleared={craCleared} />
        </section>
        <section className="col-span-12 lg:col-span-3 bg-background overflow-hidden">
          <ConditionsPanel conditions={conditions} setConditions={setConditions} />
        </section>
      </main>
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

function SubHeader() {
  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-secondary/60 px-6 text-[11.5px]">
      <div className="flex items-center gap-4">
        <span className="font-mono text-muted-foreground">FILE</span>
        <span className="font-mono font-semibold tracking-wide">#APP-2025-08842</span>
        <span className="text-border">│</span>
        <span className="text-muted-foreground">Applicant</span>
        <span className="font-semibold">Mujeeb Minhas</span>
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

function DocumentLens() {
  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        icon={<FileText className="h-3.5 w-3.5" />}
        kicker="01"
        title="Forensic Document Lens"
        subtitle="Side-by-side extraction with audit trail"
      />
      <div className="grid flex-1 grid-cols-2 gap-px overflow-hidden bg-border">
        {/* PDF viewer */}
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

        {/* Extraction panel */}
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

            {/* Warning Card */}
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
                val="$96,000.00"
                status="VARIANCE"
                tone="warn"
                delta="+1.6%"
              />
            </div>
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
}: {
  doc: string;
  val: string;
  status: string;
  tone?: "ok" | "warn";
  delta?: string;
}) {
  const color =
    tone === "warn"
      ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
      : { background: "color-mix(in oklab, var(--success) 14%, transparent)", color: "var(--success)" };
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 text-[11px] last:border-0">
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

function ScoringMatrix({ craCleared }: { craCleared: boolean }) {
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
          <RatioCard label="Stress-Tested GDS" value="34.2" cap="39.0%" tone="good" />
          <RatioCard label="Stress-Tested TDS" value="41.5" cap="44.0%" tone="good" />
          <RatioCard label="LTV Ratio" value="78.0" cap="Insured" tone="info" />
        </div>

        {/* Aggregate Risk Score */}
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

          {/* Bar */}
          <div className="mt-4">
            <div className="relative h-2 w-full bg-secondary">
              <div
                className="absolute left-0 top-0 h-full"
                style={{
                  width: "45%",
                  background:
                    "linear-gradient(90deg, var(--success), var(--warning))",
                }}
              />
              <div
                className="absolute top-[-3px] h-3 w-[2px]"
                style={{ left: "45%", background: "var(--foreground)" }}
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

        {/* Risk Flags */}
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold tracking-tight">Triggered Risk Flags</span>
            <span className="font-mono text-[10px] text-muted-foreground">2 ACTIVE</span>
          </div>
          <div className="divide-y divide-border">
            <FlagRow
              code="TAX-CRA-ARREARS"
              title="CRA balance owing detected"
              severity="Elevated"
              penalty="+15"
              tone="warn"
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

        {/* Calculation Trace */}
        <div className="border border-border bg-secondary/40 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>Calculation Trace</span>
            <span>Qualifying Rate · 7.04%</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <Trace l="Gross Annual Income" r="$94,500.00" />
            <Trace l="Monthly Income" r="$7,875.00" />
            <Trace l="P+I (Stressed)" r="$2,231.18" />
            <Trace l="Property Tax + Heat" r="$465.00" />
            <Trace l="GDS Numerator" r="$2,696.18" sub />
            <Trace l="Other Debt Servicing" r="$571.40" />
            <Trace l="TDS Numerator" r="$3,267.58" sub />
          </div>
        </div>
      </div>
    </div>
  );
}

function RatioCard({
  label,
  value,
  cap,
  tone,
}: {
  label: string;
  value: string;
  cap: string;
  tone: "good" | "info" | "bad";
}) {
  const color =
    tone === "good"
      ? "var(--success)"
      : tone === "info"
        ? "var(--info)"
        : "var(--destructive)";
  return (
    <div className="border border-border bg-card p-3">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-mono text-[22px] font-bold leading-none">{value}</span>
        <span className="text-[11px] text-muted-foreground">%</span>
      </div>
      <div className="mt-2 h-1 w-full bg-secondary">
        <div className="h-full" style={{ width: "78%", background: color }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[9.5px]">
        <span style={{ color }}>● {tone === "info" ? "Insured" : "Within"}</span>
        <span className="text-muted-foreground">Cap {cap}</span>
      </div>
    </div>
  );
}

function Mini({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="font-mono text-[15px] font-semibold">{v}</div>
    </div>
  );
}

function FlagRow({
  code,
  title,
  severity,
  penalty,
  tone,
  icon,
}: {
  code: string;
  title: string;
  severity: string;
  penalty: string;
  tone: "warn" | "ok";
  icon: React.ReactNode;
}) {
  const sev =
    tone === "warn"
      ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
      : { background: "color-mix(in oklab, var(--success) 14%, transparent)", color: "var(--success)" };
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] font-bold tracking-wide">{code}</div>
          <div className="truncate text-[11.5px] text-foreground/80">{title}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em]"
          style={sev}
        >
          {severity}
        </span>
        <span className="w-16 text-right font-mono text-[10.5px] font-semibold text-foreground">
          {penalty}
        </span>
      </div>
    </div>
  );
}

function Trace({ l, r, sub }: { l: string; r: string; sub?: boolean }) {
  return (
    <div className={`flex justify-between ${sub ? "border-t border-border pt-1 font-bold" : ""}`}>
      <span className="text-muted-foreground">{l}</span>
      <span className="text-foreground">{r}</span>
    </div>
  );
}

/* ────────────────────── COLUMN 3: CONDITIONS PANEL ────────────────────── */

type Cond = {
  id: string;
  title: string;
  category: string;
  satisfied: boolean;
};

const initialConditions: Cond[] = [
  { id: "INC-04", title: "Verify CRA Outstanding Balance", category: "Income", satisfied: false },
  { id: "EMP-02", title: "Confirm continuous employment 24 mo.", category: "Employment", satisfied: true },
  { id: "DWN-01", title: "Source of down payment — 90 day history", category: "Down Payment", satisfied: false },
  { id: "PROP-03", title: "Appraisal — independent AACI report", category: "Property", satisfied: false },
  { id: "INS-01", title: "Property insurance binder", category: "Insurance", satisfied: true },
];

function ConditionsPanel() {
  const [conditions, setConditions] = useState(initialConditions);
  const [tab, setTab] = useState<"internal" | "broker" | "borrower">("internal");

  const top = conditions[0];

  const toggleSatisfied = () => {
    setConditions((c) =>
      c.map((x, i) => (i === 0 ? { ...x, satisfied: !x.satisfied } : x))
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PaneHeader
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        kicker="03"
        title="Conditions Automation"
        subtitle="Adjudication outputs · ready to dispatch"
      />

      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2">
        <div className="flex items-center gap-3 text-[10.5px]">
          <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
            Conditions
          </span>
          <span className="font-mono font-bold">
            {conditions.filter((c) => c.satisfied).length}
            <span className="text-muted-foreground">/{conditions.length}</span>
          </span>
        </div>
        <button className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Featured condition card */}
        <div className="border-b border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span>Condition</span>
                <span className="font-bold text-foreground">{top.id}</span>
                <span className="text-border">|</span>
                <span>{top.category}</span>
              </div>
              <h3 className="mt-1 text-[14.5px] font-bold leading-snug tracking-tight">
                {top.title}
              </h3>
            </div>
            <StatusBadge satisfied={top.satisfied} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[10.5px]">
            <Meta label="Doc Type" v="CRA NOA + Receipt" />
            <Meta label="Due" v="48 hours" />
            <Meta label="Source" v="Auto-flagged" />
          </div>

          {/* Tabs */}
          <div className="mt-4 flex border-b border-border">
            {[
              { k: "internal", l: "Internal Credit Note" },
              { k: "broker", l: "Broker Portal" },
              { k: "borrower", l: "Borrower Email" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as typeof tab)}
                className={`-mb-px border-b-2 px-3 py-2 text-[11px] font-semibold tracking-tight transition-colors ${
                  tab === t.k
                    ? "text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={tab === t.k ? { borderColor: "var(--emerald)" } : undefined}
              >
                {t.l}
              </button>
            ))}
          </div>

          <div className="mt-3 border border-border bg-secondary/40">
            <div className="flex items-center justify-between border-b border-border bg-card px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Draft · auto-generated
              </span>
              <button className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="max-h-44 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
              {tab === "internal" && DRAFT_INTERNAL}
              {tab === "broker" && DRAFT_BROKER}
              {tab === "borrower" && DRAFT_BORROWER}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button className="border border-border bg-card px-3 py-1.5 text-[11px] font-semibold tracking-tight text-foreground hover:bg-secondary">
              Request Re-Submission
            </button>
            <button
              onClick={toggleSatisfied}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11.5px] font-bold tracking-tight text-primary-foreground transition-colors"
              style={{
                background: top.satisfied ? "var(--slate-ink)" : "var(--emerald-deep)",
              }}
            >
              {top.satisfied ? "Re-open Condition" : "Clear Condition"}
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Other conditions */}
        <ul className="divide-y divide-border">
          {conditions.slice(1).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {c.id} · {c.category}
                  </div>
                  <div className="truncate text-[12px] font-semibold tracking-tight">
                    {c.title}
                  </div>
                </div>
              </div>
              <StatusBadge satisfied={c.satisfied} compact />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ satisfied, compact }: { satisfied: boolean; compact?: boolean }) {
  const cls = compact ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-1 text-[10.5px]";
  if (satisfied) {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-[0.12em] ${cls}`}
        style={{
          background: "color-mix(in oklab, var(--success) 16%, transparent)",
          color: "var(--success)",
        }}
      >
        <CheckCircle2 className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /> Satisfied
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 font-bold uppercase tracking-[0.12em] ${cls}`}
      style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
    >
      <Clock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} /> Awaiting Documents
    </span>
  );
}

function Meta({ label, v }: { label: string; v: string }) {
  return (
    <div className="border border-border bg-secondary/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="font-mono text-[11px] font-semibold">{v}</div>
    </div>
  );
}

/* ────────────────────── SHARED ────────────────────── */

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
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-7 w-7 items-center justify-center text-primary-foreground"
          style={{ background: "var(--emerald-deep)" }}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
              {kicker}
            </span>
            <h2 className="text-[13px] font-bold tracking-tight">{title}</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <button className="text-muted-foreground hover:text-foreground">
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ────────────────────── DRAFT COPY ────────────────────── */

const DRAFT_INTERNAL = `CREDIT NOTE — FILE #APP-2025-08842
Applicant: Mujeeb Minhas
Condition: INC-04 — Verify CRA Outstanding Balance

OBSERVATION
The 2025 Notice of Assessment shows a balance owing of
$4,250.31 as of 2025-05-14. CRA arrears constitute a
priority lien and must be resolved or formally arranged
prior to instructing solicitors.

RECOMMENDATION
Hold instruction pending one of (a) proof of payment in
full, or (b) executed CRA payment arrangement with two
months of consecutive payment history. Re-score INC
component upon receipt.

UW: A. Khan · 2026-06-15 14:02 ET`;

const DRAFT_BROKER = `Hi team,

We've completed initial adjudication on Mujeeb Minhas
(File #APP-2025-08842) and require one outstanding item
to move to final approval:

• INC-04 — CRA Outstanding Balance ($4,250.31)
  Please provide either:
    - CRA receipt showing balance paid in full, OR
    - Signed CRA payment arrangement + 2 months of
      cleared payments from the borrower's account.

Once received, we'll re-run the risk model and target
same-day commitment issuance. SLA clock: 48 hours.

Thanks,
BrokerMindAI Adjudication Desk`;

const DRAFT_BORROWER = `Dear Mr. Minhas,

Thank you for your mortgage application. As part of our
standard review, we identified an outstanding balance of
$4,250.31 on your 2025 CRA Notice of Assessment.

To proceed, please provide ONE of the following at your
earliest convenience:

  1. A receipt or CRA account screenshot confirming the
     balance has been paid in full, or
  2. A copy of your CRA payment arrangement together
     with two months of bank statements showing the
     scheduled payments have cleared.

Documents can be uploaded securely through your broker's
portal. Please contact us if you have any questions.

Kind regards,
Adjudication Team`;
