import { useEffect, useState } from "react";
import { ChevronDown, Home, ShieldCheck, AlertTriangle } from "lucide-react";
import { fmtCAD } from "@/utils/debtService";
import type { RiskFlag } from "@/utils/noaParser";

export type DownPaymentSource =
  | "Liquid Savings"
  | "Gifted"
  | "Equity from Sale"
  | "Borrowed/Secondary Financing";

export interface CollateralState {
  propertyValue: number;
  downPayment: number;
  source: DownPaymentSource;
}

export const DEFAULT_COLLATERAL: CollateralState = {
  propertyValue: 875000,
  downPayment: 192500,
  source: "Liquid Savings",
};

const SOURCES: DownPaymentSource[] = [
  "Liquid Savings",
  "Gifted",
  "Equity from Sale",
  "Borrowed/Secondary Financing",
];

/* CMHC sliding premium grid (standard purchase) */
function insurancePremiumPct(ltv: number): number {
  if (ltv <= 80) return 0;
  if (ltv <= 85) return 2.8;
  if (ltv <= 90) return 3.1;
  if (ltv <= 95) return 4.0;
  return 4.5;
}

export function computeLtv(state: CollateralState) {
  const value = Math.max(0, state.propertyValue);
  const dp = Math.max(0, state.downPayment);
  const loan = Math.max(0, value - dp);
  const ltv = value > 0 ? (loan / value) * 100 : 0;
  const highRatio = ltv > 80;
  const premiumPct = insurancePremiumPct(ltv);
  const premium = loan * (premiumPct / 100);
  return { value, dp, loan, ltv, highRatio, premiumPct, premium };
}

export function CollateralPanel({
  state,
  setState,
  onFlagsChange,
}: {
  state: CollateralState;
  setState: React.Dispatch<React.SetStateAction<CollateralState>>;
  onFlagsChange?: (flags: RiskFlag[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const calc = computeLtv(state);

  useEffect(() => {
    const flags: RiskFlag[] = [];
    if (calc.highRatio && state.source === "Borrowed/Secondary Financing") {
      flags.push({
        code: "COMPLIANCE-HIGH-RATIO-LEVERAGE",
        title: "Borrowed down payment on high-ratio insured deal",
        detail:
          "Borrowed down payments are restricted on High-Ratio insured applications. Restructure file immediately.",
        penalty: 30,
        severity: "High",
      });
    }
    onFlagsChange?.(flags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc.highRatio, state.source]);

  const update = <K extends keyof CollateralState>(k: K, v: CollateralState[K]) =>
    setState((p) => ({ ...p, [k]: v }));

  return (
    <section className="border-b border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-2.5 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 items-center justify-center text-primary-foreground"
            style={{ background: "var(--emerald-deep)" }}
          >
            <Home className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                00
              </span>
              <h2 className="text-[13px] font-bold tracking-tight">
                Collateral &amp; Loan-to-Value Master
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Global · drives insurer tier &amp; amortization stream
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LtvPill ltv={calc.ltv} highRatio={calc.highRatio} />
          <InsurerBadge highRatio={calc.highRatio} />
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-12 gap-px border-t border-border bg-border">
          <div className="col-span-12 grid grid-cols-1 gap-px bg-border md:grid-cols-3 lg:col-span-8">
            <CurrencyField
              label="Purchase Price / Property Value"
              hint="Lesser-of contract & appraised"
              value={state.propertyValue}
              onChange={(v) => update("propertyValue", v)}
            />
            <CurrencyField
              label="Down Payment Amount"
              hint="Verified equity injection"
              value={state.downPayment}
              onChange={(v) => update("downPayment", v)}
            />
            <SelectField
              label="Down Payment Source"
              hint="OSFI source-of-funds tagging"
              value={state.source}
              options={SOURCES}
              onChange={(v) => update("source", v as DownPaymentSource)}
            />
          </div>

          <div className="col-span-12 bg-secondary/40 p-4 lg:col-span-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Live LTV Engine
            </div>
            <div className="space-y-1 font-mono text-[10.5px]">
              <CalcRow l="Loan Amount" r={fmtCAD(calc.loan)} />
              <CalcRow l="LTV Ratio" r={`${calc.ltv.toFixed(2)}%`} bold />
              {calc.highRatio && (
                <>
                  <CalcRow l={`Insurance Premium (${calc.premiumPct.toFixed(2)}%)`} r={fmtCAD(calc.premium)} />
                  <CalcRow l="Insured Loan + Premium" r={fmtCAD(calc.loan + calc.premium)} bold />
                </>
              )}
            </div>
            {calc.highRatio && state.source === "Borrowed/Secondary Financing" && (
              <div
                className="mt-3 flex items-start gap-2 border-l-2 p-2"
                style={{
                  borderColor: "var(--destructive)",
                  background: "color-mix(in oklab, var(--destructive) 10%, transparent)",
                  color: "var(--destructive)",
                }}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="text-[10.5px] font-semibold leading-snug">
                  Borrowed funds disallowed on insured high-ratio files.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function LtvPill({ ltv, highRatio }: { ltv: number; highRatio: boolean }) {
  const style = highRatio
    ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
    : {
        background: "color-mix(in oklab, var(--success) 14%, transparent)",
        color: "var(--success)",
      };
  return (
    <span
      className="hidden items-center gap-1.5 px-2 py-1 font-mono text-[10.5px] font-bold tracking-[0.12em] md:inline-flex"
      style={style}
    >
      <span className="opacity-75">LTV</span>
      <span>{ltv.toFixed(1)}%</span>
    </span>
  );
}

function InsurerBadge({ highRatio }: { highRatio: boolean }) {
  if (highRatio) {
    return (
      <span
        className="hidden items-center gap-1.5 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] md:inline-flex"
        style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
      >
        <AlertTriangle className="h-3 w-3" />
        High-Ratio Insured · Max 25-Yr Am
      </span>
    );
  }
  return (
    <span
      className="hidden items-center gap-1.5 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] md:inline-flex"
      style={{
        background: "color-mix(in oklab, var(--success) 14%, transparent)",
        color: "var(--success)",
      }}
    >
      <ShieldCheck className="h-3 w-3" />
      Conventional · 30-Yr Am Eligible
    </span>
  );
}

function CurrencyField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex cursor-text flex-col bg-card px-3 py-2.5 hover:bg-secondary/30 transition-colors">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-[12px] text-muted-foreground">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent font-mono text-[14px] font-bold tracking-tight outline-none focus:text-foreground"
        />
      </div>
      <span className="mt-0.5 text-[9.5px] text-muted-foreground">{hint}</span>
    </label>
  );
}

function SelectField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col bg-card px-3 py-2.5 hover:bg-secondary/30 transition-colors">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full cursor-pointer bg-transparent font-mono text-[13px] font-bold tracking-tight outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="mt-0.5 text-[9.5px] text-muted-foreground">{hint}</span>
    </label>
  );
}

function CalcRow({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "border-t border-border pt-1 font-bold text-foreground" : "text-muted-foreground"
      }`}
    >
      <span>{l}</span>
      <span className="text-foreground">{r}</span>
    </div>
  );
}
