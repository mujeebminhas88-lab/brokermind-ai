import { useState } from "react";
import { Users, Sliders, RotateCcw } from "lucide-react";
import { fmtCAD } from "@/utils/debtService";
import {
  useApplicationStore,
  useLoanInputs,
  useDerivedFinancials,
  type LoanInputs,
  DEFAULT_LOAN_INPUTS,
} from "@/store/applicationStore";

/**
 * LoanTermsPanel — wired DIRECTLY to the global Application Store.
 *
 * No local financial useState. Every input mutates the store via
 * `setLoanField`; LTV / GDS / TDS / P+I come from `useDerivedFinancials`.
 */

// Back-compat re-exports so existing imports continue to compile.
export type LoanTerms = LoanInputs;
export const DEFAULT_LOAN_TERMS: LoanInputs = DEFAULT_LOAN_INPUTS;

const AMORT_OPTIONS = [5, 10, 15, 20, 25, 30] as const;
const TERM_OPTIONS: Array<{ label: string; months: number }> = [
  { label: "6 mo", months: 6 },
  { label: "1 yr", months: 12 },
  { label: "2 yr", months: 24 },
  { label: "3 yr", months: 36 },
  { label: "4 yr", months: 48 },
  { label: "5 yr", months: 60 },
  { label: "6 yr", months: 72 },
  { label: "7 yr", months: 84 },
];

export function LoanTermsPanel(_props?: {
  // Props are ignored — store is the source of truth. Kept optional so
  // existing callers compile without modification.
  state?: LoanInputs;
  setState?: unknown;
}) {
  const [open, setOpen] = useState(true);
  const loan = useLoanInputs();
  const setField = useApplicationStore((s) => s.setLoanField);
  const resetLoan = useApplicationStore((s) => s.resetLoan);
  const calc = useDerivedFinancials();

  const update = <K extends keyof LoanInputs>(k: K, v: LoanInputs[K]) => setField(k, v);

  return (
    <section className="rounded-sm border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-border px-5 py-3 text-left hover:bg-muted/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground">
            <Sliders className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold tracking-tight">
              Loan Terms · Amortization · Co-Applicant
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Bound to global store · drives LTV, P+I, GDS &amp; TDS in real time
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill label="LTV" value={`${calc.ltv.toFixed(1)}%`} tone={calc.ltv > 80 ? "warn" : "ok"} />
          <Pill
            label="GDS"
            value={`${calc.ds.gds.toFixed(1)}%`}
            tone={calc.ds.gdsExceeded ? "warn" : "ok"}
          />
          <Pill
            label="TDS"
            value={`${calc.ds.tds.toFixed(1)}%`}
            tone={calc.ds.tdsExceeded ? "warn" : "ok"}
          />
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-12 gap-px bg-border">
          <div className="col-span-12 grid grid-cols-2 gap-px bg-border md:grid-cols-4 lg:col-span-8">
            <NumField label="Property Price" prefix="$" value={loan.propertyPrice} onChange={(v) => update("propertyPrice", v)} />
            <NumField label="Down Payment" prefix="$" value={loan.downPayment} onChange={(v) => update("downPayment", v)} />
            <NumField label="Contract Rate" suffix="%" step={0.01} value={loan.interestRatePct} onChange={(v) => update("interestRatePct", v)} />
            <NumField label="ROE — Return on Equity" suffix="%" step={0.1} value={loan.roePct} onChange={(v) => update("roePct", v)} />
          </div>

          <aside className="col-span-12 bg-secondary/40 p-4 lg:col-span-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Live Loan Math (global)
              </span>
              <button
                type="button"
                onClick={resetLoan}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="space-y-1 font-mono text-[10.5px]">
              <Row l="Loan Amount" r={fmtCAD(calc.loanAmount)} />
              <Row l="Monthly P+I" r={fmtCAD(calc.monthlyPI)} bold />
              <Row l="Household Income (annual)" r={fmtCAD(calc.householdIncome)} />
              <Row l="LTV" r={`${calc.ltv.toFixed(2)}%`} bold />
              <Row l="GDS / TDS" r={`${calc.ds.gds.toFixed(1)}% / ${calc.ds.tds.toFixed(1)}%`} bold />
            </div>
          </aside>

          <div className="col-span-12 bg-card p-5">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="amort" className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Amortization Period
                </label>
                <span className="font-mono text-sm font-bold">{loan.amortizationYears} years</span>
              </div>
              <input
                id="amort"
                type="range"
                min={5}
                max={30}
                step={5}
                value={loan.amortizationYears}
                onChange={(e) => update("amortizationYears", Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                {AMORT_OPTIONS.map((y) => (
                  <span key={y}>{y}y</span>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Mortgage Term (6 months – 7 years)
              </div>
              <div className="flex flex-wrap gap-1">
                {TERM_OPTIONS.map((t) => (
                  <button
                    key={t.months}
                    type="button"
                    onClick={() => update("termMonths", t.months)}
                    className={`rounded-sm border px-3 py-1 font-mono text-[11px] font-semibold transition-colors ${
                      loan.termMonths === t.months
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12 grid grid-cols-2 gap-px bg-border md:grid-cols-4">
            <NumField label="Primary Annual Income" prefix="$" value={loan.primaryAnnualIncome} onChange={(v) => update("primaryAnnualIncome", v)} />
            <NumField label="Primary Other Monthly Debt" prefix="$" value={loan.primaryOtherMonthlyDebt} onChange={(v) => update("primaryOtherMonthlyDebt", v)} />
            <NumField label="Annual Property Tax" prefix="$" value={loan.annualPropertyTaxes} onChange={(v) => update("annualPropertyTaxes", v)} />
            <NumField label="Monthly Heating" prefix="$" value={loan.monthlyHeating} onChange={(v) => update("monthlyHeating", v)} />
            <NumField label="Monthly Condo / Strata" prefix="$" value={loan.monthlyCondoFees} onChange={(v) => update("monthlyCondoFees", v)} />
          </div>

          <div className="col-span-12 bg-card p-5">
            <label className="mb-3 flex cursor-pointer items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-[12px] font-bold tracking-tight">Co-Applicant</span>
                <span className="text-[11px] text-muted-foreground">
                  Linked income &amp; liabilities roll into household ratios
                </span>
              </span>
              <span className="relative">
                <input
                  type="checkbox"
                  checked={loan.coApplicantEnabled}
                  onChange={(e) => update("coApplicantEnabled", e.target.checked)}
                  className="peer sr-only"
                />
                <span className="block h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                <span className="absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>

            {loan.coApplicantEnabled && (
              <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
                <NumField label="Co-Applicant Annual Income" prefix="$" value={loan.coAnnualIncome} onChange={(v) => update("coAnnualIncome", v)} />
                <NumField label="Co-Applicant Other Monthly Debt" prefix="$" value={loan.coOtherMonthlyDebt} onChange={(v) => update("coOtherMonthlyDebt", v)} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function NumField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="flex cursor-text flex-col bg-card px-3 py-2.5 hover:bg-secondary/30">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-baseline gap-1">
        {prefix && <span className="font-mono text-[12px] text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent font-mono text-[14px] font-bold tracking-tight outline-none focus:text-foreground"
        />
        {suffix && <span className="font-mono text-[12px] text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  const style =
    tone === "warn"
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
      <span className="opacity-75">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
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
