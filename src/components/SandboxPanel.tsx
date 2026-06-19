import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Zap, RotateCcw, Banknote, Landmark } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  analyzeNoticeOfAssessment,
  type NoaAnalysis,
  type NoaPayload,
  type RiskFlag,
} from "@/utils/noaParser";

export type UnderwritingStream = "standard" | "bfs";

export type SandboxFields = {
  taxpayer_name: string;
  tax_year: number;
  line_15000_total_income: number;
  prior_year_line_15000: number;
  line_23600_net_income: number;
  balance_owing_at_assessment: number;
  has_unarranged_arrears: boolean;
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
  const [fields, setFields] = useState<SandboxFields>(DEFAULTS);
  const [bfs, setBfs] = useState<BfsFields>(BFS_DEFAULTS);

  const statedAddBackIncome = useMemo(() => {
    const gross = Math.max(0, bfs.gross_business_deposits);
    const inj = Math.max(0, bfs.non_business_injections);
    const ratio = Math.min(0.8, Math.max(0.1, bfs.expense_ratio_pct / 100));
    const net = Math.max(0, gross - inj);
    // Normalize to annual: 24-mo programs average over 2 years.
    const annualized = bfs.statement_months === 24 ? net / 2 : net;
    return annualized * (1 - ratio);
  }, [bfs]);

  // Reactive recompute on any field change
  useEffect(() => {
    try {
      const isBfs = stream === "bfs";
      const qualifyingIncome = isBfs
        ? Math.max(0, statedAddBackIncome)
        : Math.max(0, fields.line_15000_total_income);

      const payload: NoaPayload = {
        taxpayer_name: fields.taxpayer_name || "Unnamed Applicant",
        tax_year: fields.tax_year,
        line_15000_total_income: qualifyingIncome,
        // In BFS, suppress YoY comparison by mirroring prior year.
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

      // Inject forensic AML flag when BFS and non-business injections present.
      if (isBfs && bfs.non_business_injections > 0) {
        const amlFlag: RiskFlag = {
          code: "FORENSIC-AML-INJECTION",
          title: "Unidentified large cash deposit detected",
          detail:
            "Source verification required for 90-day anti-money laundering compliance. Obtain bank trace and declaration of origin for the flagged transfer(s).",
          penalty: 12,
          severity: "Elevated",
        };
        const flags = [...result.flags, amlFlag];
        const aggregatePenalty = flags.reduce((s, f) => s + f.penalty, 0);
        onAnalyzed({ ...result, flags, aggregatePenalty });
      } else {
        onAnalyzed(result);
      }
    } catch {
      // ignore transient invalid states (e.g. NaN while typing)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, bfs, stream, statedAddBackIncome]);

  function update<K extends keyof SandboxFields>(key: K, val: SandboxFields[K]) {
    setFields((f) => ({ ...f, [key]: val }));
  }
  function updateBfs<K extends keyof BfsFields>(key: K, val: BfsFields[K]) {
    setBfs((f) => ({ ...f, [key]: val }));
  }

  function reset() {
    setFields(DEFAULTS);
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
      {/* Top utility bar */}
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

      {/* Standard NOA fields — always rendered as core identity payload */}
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
        {stream === "standard" ? (
          <>
            <SandboxCurrency
              label="Line 15000 · Total Income"
              value={fields.line_15000_total_income}
              onChange={(v) => update("line_15000_total_income", v)}
            />
            <SandboxCurrency
              label="Prior Year Line 15000"
              value={fields.prior_year_line_15000}
              onChange={(v) => update("prior_year_line_15000", v)}
              hint="Drop current below this to trigger TAX-DROP-YOY"
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
              hint="> $0 triggers TAX-CRA-ARREARS (+25 pts)"
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
          </>
        ) : (
          <div className="col-span-2 lg:col-span-2 bg-card px-3 py-2.5 flex items-center gap-2">
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
        )}
      </div>

      {/* BFS extended controls */}
      {stream === "bfs" && (
        <BfsControls
          bfs={bfs}
          update={updateBfs}
          statedAddBackIncome={statedAddBackIncome}
        />
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
                ? {
                    background: "var(--emerald-deep)",
                    color: "var(--primary-foreground)",
                  }
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

      {/* Live computation strip */}
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        <Stat label="Annualized Net Deposits" value={fmtCAD(annualized)} />
        <Stat label="Expense Write-Off" value={`${bfs.expense_ratio_pct}%`} />
        <Stat
          label="Stated Add-Back Income"
          value={fmtCAD(statedAddBackIncome)}
          highlight
        />
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
