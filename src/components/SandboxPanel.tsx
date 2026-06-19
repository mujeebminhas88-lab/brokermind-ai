import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Zap, RotateCcw, Banknote, Landmark, FileText, Briefcase, Wallet } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  analyzeNoticeOfAssessment,
  type NoaAnalysis,
  type NoaPayload,
  type RiskFlag,
} from "@/utils/noaParser";

export type UnderwritingStream = "standard" | "bfs";
type StandardTab = "t4" | "t1" | "t4a";

export type SandboxFields = {
  taxpayer_name: string;
  tax_year: number;
  // NOA reconciliation anchor
  line_15000_total_income: number;
  prior_year_line_15000: number;
  line_23600_net_income: number;
  balance_owing_at_assessment: number;
  has_unarranged_arrears: boolean;
};

export type SlipFields = {
  // T4
  t4_employer_name: string;
  t4_box14_employment_income: number;
  t4_box22_tax_deducted: number;
  // T1 General
  t1_line13500_business_gross: number;
  t1_line13500_business_net: number;
  t776_net_rental_income: number;
  // T4A / T4P
  t4a_box20_commissions: number;
  t4p_box16_pension: number;
};

export type BfsFields = {
  statement_months: 12 | 24;
  gross_business_deposits: number;
  non_business_injections: number;
  expense_ratio_pct: number; // 10 - 80
};

const DEFAULTS: SandboxFields = {
  taxpayer_name: "Mujeeb Minhas",
  tax_year: 2025,
  line_15000_total_income: 94500,
  prior_year_line_15000: 93100,
  line_23600_net_income: 88940.12,
  balance_owing_at_assessment: 4250.31,
  has_unarranged_arrears: true,
};

const SLIP_DEFAULTS: SlipFields = {
  t4_employer_name: "Northbridge Financial Corp.",
  t4_box14_employment_income: 78420,
  t4_box22_tax_deducted: 16765.28,
  t1_line13500_business_gross: 0,
  t1_line13500_business_net: 0,
  t776_net_rental_income: 0,
  t4a_box20_commissions: 12180,
  t4p_box16_pension: 3900,
};

const BFS_DEFAULTS: BfsFields = {
  statement_months: 12,
  gross_business_deposits: 285000,
  non_business_injections: 0,
  expense_ratio_pct: 45,
};

export function SandboxToggleBar({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between border-b border-border bg-card px-6 py-2.5"
      style={
        enabled
          ? {
              background:
                "linear-gradient(90deg, color-mix(in oklab, var(--emerald) 10%, var(--card)) 0%, var(--card) 60%)",
              borderColor: "var(--emerald)",
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-7 w-7 items-center justify-center"
          style={{
            background: enabled ? "var(--emerald-deep)" : "var(--secondary)",
            color: enabled ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          <FlaskConical className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
              UNDERWRITER OVERRIDE
            </span>
            <h2 className="text-[13px] font-bold tracking-tight">Developer Sandbox Mode</h2>
          </div>
          {enabled ? (
            <p
              className="flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: "var(--emerald-deep)" }}
            >
              <Zap className="h-3 w-3" /> Sandbox Mode Active · Simulating Underwriting Payloads
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Bypass OCR pipeline · stress-test scoring with manual payloads
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="font-mono text-[10px] font-bold tracking-[0.18em]"
          style={{ color: enabled ? "var(--emerald-deep)" : "var(--muted-foreground)" }}
        >
          {enabled ? "ON" : "OFF"}
        </span>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Toggle sandbox mode" />
      </div>
    </div>
  );
}

export function SandboxPanel({
  onAnalyzed,
  onClear,
}: {
  onAnalyzed: (a: NoaAnalysis) => void;
  onClear: () => void;
}) {
  const [stream, setStream] = useState<UnderwritingStream>("standard");
  const [tab, setTab] = useState<StandardTab>("t4");
  const [fields, setFields] = useState<SandboxFields>(DEFAULTS);
  const [slips, setSlips] = useState<SlipFields>(SLIP_DEFAULTS);
  const [bfs, setBfs] = useState<BfsFields>(BFS_DEFAULTS);

  /* ── Standard stream: total qualifying income across slips ── */
  const slipBreakdown = useMemo(() => {
    const t4 = Math.max(0, slips.t4_box14_employment_income);
    const t1Biz = Math.max(0, slips.t1_line13500_business_net);
    const t776 = Math.max(0, slips.t776_net_rental_income);
    const t4a = Math.max(0, slips.t4a_box20_commissions);
    const t4p = Math.max(0, slips.t4p_box16_pension);
    const total = t4 + t1Biz + t776 + t4a + t4p;
    // Variance check only against direct CRA-issued slips
    const slipOnlyForVariance = t4 + t4a + t4p;
    return { t4, t1Biz, t776, t4a, t4p, total, slipOnlyForVariance };
  }, [slips]);

  const variance = useMemo(() => {
    const diff = slipBreakdown.slipOnlyForVariance - fields.line_15000_total_income;
    return {
      diff,
      abs: Math.abs(diff),
      breached: Math.abs(diff) > 1000,
    };
  }, [slipBreakdown, fields.line_15000_total_income]);

  /* ── BFS stream: stated add-back income ── */
  const statedAddBackIncome = useMemo(() => {
    const gross = Math.max(0, bfs.gross_business_deposits);
    const inj = Math.max(0, bfs.non_business_injections);
    const ratio = Math.min(0.8, Math.max(0.1, bfs.expense_ratio_pct / 100));
    const net = Math.max(0, gross - inj);
    const annualized = bfs.statement_months === 24 ? net / 2 : net;
    return annualized * (1 - ratio);
  }, [bfs]);

  useEffect(() => {
    try {
      const isBfs = stream === "bfs";
      const qualifyingIncome = isBfs
        ? Math.max(0, statedAddBackIncome)
        : Math.max(0, slipBreakdown.total);

      const payload: NoaPayload = {
        taxpayer_name: fields.taxpayer_name || "Unnamed Applicant",
        tax_year: fields.tax_year,
        line_15000_total_income: qualifyingIncome,
        prior_year_line_15000: isBfs ? qualifyingIncome : Math.max(0, fields.prior_year_line_15000),
        line_23600_net_income: isBfs
          ? qualifyingIncome * 0.92
          : Math.max(0, fields.line_23600_net_income),
        balance_owing_at_assessment: isBfs ? 0 : fields.balance_owing_at_assessment,
        has_unarranged_arrears: isBfs ? false : fields.has_unarranged_arrears,
        document_title_raw: isBfs
          ? `BFS ${bfs.statement_months}-Month Bank Statement Program`
          : "Sandbox Simulated Payload",
      };

      const result = analyzeNoticeOfAssessment(payload);
      const extra: RiskFlag[] = [];

      if (isBfs && bfs.non_business_injections > 0) {
        extra.push({
          code: "FORENSIC-AML-INJECTION",
          title: "Unidentified large cash deposit detected",
          detail:
            "Source verification required for 90-day anti-money laundering compliance. Obtain bank trace and declaration of origin for the flagged transfer(s).",
          penalty: 12,
          severity: "Elevated",
        });
      }

      if (!isBfs && variance.breached) {
        extra.push({
          code: "FORENSIC-VARIANCE-UNRECONCILED",
          title: "Slip vs NOA income discrepancy",
          detail: `Income discrepancy detected between CRA Notice of Assessment (Line 15000 = ${fmtCAD(
            fields.line_15000_total_income
          )}) and submitted tax slips (T4/T4A/T1 = ${fmtCAD(
            slipBreakdown.slipOnlyForVariance
          )}). Δ ${fmtCAD(variance.abs)}. Audit required.`,
          penalty: 14,
          severity: "Elevated",
        });
      }

      if (extra.length === 0) {
        onAnalyzed(result);
      } else {
        const flags = [...result.flags, ...extra];
        const aggregatePenalty = flags.reduce((s, f) => s + f.penalty, 0);
        onAnalyzed({ ...result, flags, aggregatePenalty });
      }
    } catch {
      // ignore transient invalid states
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, slips, bfs, stream, statedAddBackIncome, slipBreakdown, variance]);

  function update<K extends keyof SandboxFields>(key: K, val: SandboxFields[K]) {
    setFields((f) => ({ ...f, [key]: val }));
  }
  function updateSlip<K extends keyof SlipFields>(key: K, val: SlipFields[K]) {
    setSlips((f) => ({ ...f, [key]: val }));
  }
  function updateBfs<K extends keyof BfsFields>(key: K, val: BfsFields[K]) {
    setBfs((f) => ({ ...f, [key]: val }));
  }

  function reset() {
    setFields(DEFAULTS);
    setSlips(SLIP_DEFAULTS);
    setBfs(BFS_DEFAULTS);
  }

  const years = [2025, 2024, 2023, 2022, 2021];

  return (
    <div
      className="border-b border-border"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--emerald) 4%, var(--card)) 0%, var(--card) 100%)",
      }}
    >
      <div className="grid grid-cols-12 gap-px bg-border">
        <div className="col-span-12 bg-card px-6 py-2 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
              MANUAL PAYLOAD INJECTOR · LIVE SCORING
            </span>
            <StreamTabs stream={stream} onChange={setStream} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 border border-border bg-card px-2.5 py-1 text-[10.5px] font-semibold tracking-tight hover:bg-secondary"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <button
              onClick={onClear}
              className="border border-border bg-card px-2.5 py-1 text-[10.5px] font-semibold tracking-tight text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Clear Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Identity / NOA anchor row — always rendered for the standard stream */}
      {stream === "standard" ? (
        <>
          <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
            <SandboxText
              label="Taxpayer Name"
              value={fields.taxpayer_name}
              onChange={(v) => update("taxpayer_name", v)}
            />
            <SandboxSelect
              label="Tax Year"
              value={fields.tax_year}
              options={years}
              onChange={(v) => update("tax_year", v)}
            />
            <SandboxCurrency
              label="NOA · Line 15000 (Anchor)"
              value={fields.line_15000_total_income}
              onChange={(v) => update("line_15000_total_income", v)}
              hint="Reconciled against slip aggregate"
            />
            <SandboxCurrency
              label="Prior Year Line 15000"
              value={fields.prior_year_line_15000}
              onChange={(v) => update("prior_year_line_15000", v)}
            />
            <SandboxCurrency
              label="Line 23600 · Net Income"
              value={fields.line_23600_net_income}
              onChange={(v) => update("line_23600_net_income", v)}
            />
            <SandboxCurrency
              label="Balance Owing at Assessment"
              value={fields.balance_owing_at_assessment}
              onChange={(v) => update("balance_owing_at_assessment", v)}
              hint="> $0 triggers TAX-CRA-ARREARS"
            />
            <SandboxCheckbox
              label="Has Unarranged Arrears"
              value={fields.has_unarranged_arrears}
              onChange={(v) => update("has_unarranged_arrears", v)}
            />
            <div className="bg-card px-3 py-2.5 flex flex-col justify-center">
              <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] text-muted-foreground">
                STATE
              </div>
              <div
                className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: "var(--emerald-deep)" }}
              >
                <span className="h-1.5 w-1.5 animate-pulse" style={{ background: "var(--emerald)" }} />
                Streaming to scoring engine
              </div>
            </div>
          </div>

          <SlipTabs
            tab={tab}
            onTabChange={setTab}
            slips={slips}
            update={updateSlip}
            breakdown={slipBreakdown}
            variance={variance}
            noaLine15000={fields.line_15000_total_income}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
            <SandboxText
              label="Taxpayer Name"
              value={fields.taxpayer_name}
              onChange={(v) => update("taxpayer_name", v)}
            />
            <SandboxSelect
              label="Tax Year"
              value={fields.tax_year}
              options={years}
              onChange={(v) => update("tax_year", v)}
            />
            <div className="col-span-2 bg-card px-3 py-2.5 flex items-center gap-2">
              <Landmark className="h-3.5 w-3.5" style={{ color: "var(--emerald-deep)" }} />
              <div className="leading-tight">
                <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] text-muted-foreground">
                  ALTERNATIVE / PRIVATE BFS STREAM
                </div>
                <div className="text-[11px] font-semibold">
                  NOA fields suppressed · qualifying income derived from bank statement add-backs
                </div>
              </div>
            </div>
          </div>
          <BfsControls bfs={bfs} update={updateBfs} statedAddBackIncome={statedAddBackIncome} />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── Stream tabs ─────────────────────────── */

function StreamTabs({
  stream,
  onChange,
}: {
  stream: UnderwritingStream;
  onChange: (s: UnderwritingStream) => void;
}) {
  const opts: { id: UnderwritingStream; label: string; sub: string }[] = [
    { id: "standard", label: "Standard A-Lender", sub: "NOA + T4 Focus" },
    { id: "bfs", label: "Alternative / Private BFS", sub: "12/24-Mo Bank Statement Focus" },
  ];
  return (
    <div className="flex items-center gap-1 border border-border bg-secondary p-0.5">
      {opts.map((o) => {
        const active = stream === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className="flex items-center gap-2 px-2.5 py-1 text-[10.5px] font-semibold tracking-tight"
            style={
              active
                ? { background: "var(--emerald-deep)", color: "var(--primary-foreground)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            <span className="font-mono text-[9.5px] tracking-[0.14em]">
              {o.id === "standard" ? "A" : "B/PVT"}
            </span>
            <span>{o.label}</span>
            <span className="hidden md:inline opacity-70">· {o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Slip tabs ─────────────────────────── */

function SlipTabs({
  tab,
  onTabChange,
  slips,
  update,
  breakdown,
  variance,
  noaLine15000,
}: {
  tab: StandardTab;
  onTabChange: (t: StandardTab) => void;
  slips: SlipFields;
  update: <K extends keyof SlipFields>(k: K, v: SlipFields[K]) => void;
  breakdown: { t4: number; t1Biz: number; t776: number; t4a: number; t4p: number; total: number; slipOnlyForVariance: number };
  variance: { diff: number; abs: number; breached: boolean };
  noaLine15000: number;
}) {
  const tabs: { id: StandardTab; label: string; icon: React.ReactNode }[] = [
    { id: "t4", label: "T4 — Employment", icon: <FileText className="h-3 w-3" /> },
    { id: "t1", label: "T1 General — Self-Employed", icon: <Briefcase className="h-3 w-3" /> },
    { id: "t4a", label: "T4A / T4P — Commissions & Pension", icon: <Wallet className="h-3 w-3" /> },
  ];

  return (
    <div className="border-t border-border" style={{ background: "color-mix(in oklab, var(--emerald) 4%, var(--card))" }}>
      <div className="px-6 py-2 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
          CRA SLIPS · CROSS-DOCUMENT RECONCILIATION
        </span>
        <div className="ml-2 flex items-center gap-0.5 border border-border bg-secondary p-0.5">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold"
                style={
                  active
                    ? { background: "var(--emerald-deep)", color: "var(--primary-foreground)" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {tab === "t4" && (
          <>
            <SandboxText
              label="T4 · Employer Name"
              value={slips.t4_employer_name}
              onChange={(v) => update("t4_employer_name", v)}
            />
            <SandboxCurrency
              label="T4 Box 14 · Employment Income"
              value={slips.t4_box14_employment_income}
              onChange={(v) => update("t4_box14_employment_income", v)}
            />
            <SandboxCurrency
              label="T4 Box 22 · Income Tax Deducted"
              value={slips.t4_box22_tax_deducted}
              onChange={(v) => update("t4_box22_tax_deducted", v)}
            />
          </>
        )}
        {tab === "t1" && (
          <>
            <SandboxCurrency
              label="T1 Line 13500 · Business Income (Gross)"
              value={slips.t1_line13500_business_gross}
              onChange={(v) => update("t1_line13500_business_gross", v)}
            />
            <SandboxCurrency
              label="T1 Line 13500 · Business Income (Net)"
              value={slips.t1_line13500_business_net}
              onChange={(v) => update("t1_line13500_business_net", v)}
              hint="Net flows into qualifying pool"
            />
            <SandboxCurrency
              label="T776 · Net Rental Income"
              value={slips.t776_net_rental_income}
              onChange={(v) => update("t776_net_rental_income", v)}
            />
          </>
        )}
        {tab === "t4a" && (
          <>
            <SandboxCurrency
              label="T4A Box 20 · Self-Employed Commissions"
              value={slips.t4a_box20_commissions}
              onChange={(v) => update("t4a_box20_commissions", v)}
            />
            <SandboxCurrency
              label="T4P Box 16 · Pension / OAS Income"
              value={slips.t4p_box16_pension}
              onChange={(v) => update("t4p_box16_pension", v)}
            />
          </>
        )}
      </div>

      {/* Reconciliation ledger */}
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-6">
        <Stat label="T4 Box 14" value={fmtCAD(breakdown.t4)} />
        <Stat label="T1 Net + T776" value={fmtCAD(breakdown.t1Biz + breakdown.t776)} />
        <Stat label="T4A + T4P" value={fmtCAD(breakdown.t4a + breakdown.t4p)} />
        <Stat label="Σ Qualifying Income" value={fmtCAD(breakdown.total)} highlight />
        <Stat label="NOA Line 15000" value={fmtCAD(noaLine15000)} />
        <Stat
          label={`Variance Δ ${variance.diff >= 0 ? "+" : "−"}${fmtCAD(variance.abs).replace(/^-/, "")}`}
          value={variance.breached ? "UNRECONCILED" : "RECONCILED"}
          warn={variance.breached}
          highlight={!variance.breached}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── BFS controls ─────────────────────────── */

function BfsControls({
  bfs,
  update,
  statedAddBackIncome,
}: {
  bfs: BfsFields;
  update: <K extends keyof BfsFields>(k: K, v: BfsFields[K]) => void;
  statedAddBackIncome: number;
}) {
  const annualized =
    bfs.statement_months === 24
      ? Math.max(0, bfs.gross_business_deposits - bfs.non_business_injections) / 2
      : Math.max(0, bfs.gross_business_deposits - bfs.non_business_injections);

  return (
    <div className="border-t border-border" style={{ background: "color-mix(in oklab, var(--emerald) 5%, var(--card))" }}>
      <div className="px-6 py-2 flex items-center gap-2">
        <Banknote className="h-3.5 w-3.5" style={{ color: "var(--emerald-deep)" }} />
        <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
          BANK STATEMENT VERIFICATION · EXTENDED INGESTION
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <FieldShell label="Statement Duration">
          <select
            value={bfs.statement_months}
            onChange={(e) => update("statement_months", Number(e.target.value) as 12 | 24)}
            className={inputCls}
          >
            <option value={12}>12 Months</option>
            <option value={24}>24 Months</option>
          </select>
        </FieldShell>

        <SandboxCurrency
          label="Gross Business Deposits"
          value={bfs.gross_business_deposits}
          onChange={(v) => update("gross_business_deposits", v)}
          hint={`Aggregate inflows across ${bfs.statement_months} months`}
        />

        <SandboxCurrency
          label="Non-Business Injections"
          value={bfs.non_business_injections}
          onChange={(v) => update("non_business_injections", v)}
          hint="> $0 triggers FORENSIC-AML-INJECTION (+12 pts)"
        />

        <FieldShell
          label="Blended Expense Ratio Factor"
          hint="Operational write-off margin standard for the industry"
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={80}
              step={1}
              value={bfs.expense_ratio_pct}
              onChange={(e) => update("expense_ratio_pct", Number(e.target.value))}
              className="h-2 flex-1 accent-[var(--emerald-deep)]"
            />
            <span className="w-12 text-right font-mono text-[11.5px] font-bold">
              {bfs.expense_ratio_pct}%
            </span>
          </div>
        </FieldShell>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        <Stat label="Annualized Net Deposits" value={fmtCAD(annualized)} />
        <Stat label="Expense Write-Off" value={`${bfs.expense_ratio_pct}%`} />
        <Stat label="Stated Add-Back Income" value={fmtCAD(statedAddBackIncome)} highlight />
        <Stat
          label="Forensic AML Flag"
          value={bfs.non_business_injections > 0 ? "TRIGGERED" : "CLEAR"}
          warn={bfs.non_business_injections > 0}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-card px-3 py-2">
      <div className="font-mono text-[9px] font-bold tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        className="mt-0.5 font-mono text-[12px] font-bold"
        style={
          warn
            ? { color: "var(--warning-fg)" }
            : highlight
            ? { color: "var(--emerald-deep)" }
            : undefined
        }
      >
        {value}
      </div>
    </div>
  );
}

function fmtCAD(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

/* ─────────────────────────── Shared inputs ─────────────────────────── */

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card px-3 py-2.5">
      <label className="font-mono text-[9.5px] font-bold tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && (
        <div className="mt-1 font-mono text-[9.5px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

const inputCls =
  "h-7 w-full border border-border bg-background px-2 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-ring";

function SandboxText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </FieldShell>
  );
}

function SandboxSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <FieldShell label={label}>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function SandboxCurrency({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">
          $
        </span>
        <input
          type="number"
          step="0.01"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`${inputCls} pl-5`}
        />
      </div>
    </FieldShell>
  );
}

function SandboxCheckbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <FieldShell label={label}>
      <label className="flex h-7 items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--emerald-deep)]"
        />
        <span
          className="font-mono text-[11px] font-semibold"
          style={{ color: value ? "var(--warning-fg)" : "var(--muted-foreground)" }}
        >
          {value ? "TRUE · arrears flagged" : "FALSE · no arrears"}
        </span>
      </label>
    </FieldShell>
  );
}
