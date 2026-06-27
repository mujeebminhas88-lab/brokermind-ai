import { useMemo, useState } from "react";
import { Users, Sliders, RotateCcw } from "lucide-react";
import { calculateDebtService, fmtCAD, type LiabilityInputs } from "@/utils/debtService";

/**
 * LoanTermsPanel
 *
 * Reactive loan-math control surface for the BrokerMind workspace.
 * Owns: amortization (5-yr increments), mortgage term (6mo–7yr),
 *       interest rate, property price, down payment, ROE,
 *       optional co-applicant income & liabilities.
 *
 * All inputs flow through a single derived state object so LTV / GDS / TDS
 * recompute on every keystroke / slider change without any side effects.
 */

export interface LoanTerms {
  propertyPrice: number;
  downPayment: number;
  interestRatePct: number;       // annual contract rate
  amortizationYears: number;     // 5-yr increments, 5–30
  termMonths: number;            // 6, 12, 24, 36, 48, 60, 72, 84
  roePct: number;                // Return on Equity
  primaryAnnualIncome: number;
  primaryOtherMonthlyDebt: number;
  coApplicantEnabled: boolean;
  coAnnualIncome: number;
  coOtherMonthlyDebt: number;
  annualPropertyTaxes: number;
  monthlyHeating: number;
  monthlyCondoFees: number;
}

export const DEFAULT_LOAN_TERMS: LoanTerms = {
  propertyPrice: 875_000,
  downPayment: 192_500,
  interestRatePct: 5.24,
  amortizationYears: 25,
  termMonths: 60,
  roePct: 12,
  primaryAnnualIncome: 145_000,
  primaryOtherMonthlyDebt: 571.4,
  coApplicantEnabled: false,
  coAnnualIncome: 0,
  coOtherMonthlyDebt: 0,
  annualPropertyTaxes: 4_200,
  monthlyHeating: 115,
  monthlyCondoFees: 0,
};

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

/** Standard mortgage payment (P+I), Canadian semi-annual compounding. */
function monthlyPaymentCAD(principal: number, annualRatePct: number, amortYears: number) {
  if (principal <= 0 || amortYears <= 0) return 0;
  const r = annualRatePct / 100;
  // Convert semi-annual compounded nominal rate to effective monthly
  const monthlyRate = Math.pow(1 + r / 2, 2 / 12) - 1;
  const n = amortYears * 12;
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

export function LoanTermsPanel({
  state,
  setState,
}: {
  state: LoanTerms;
  setState: React.Dispatch<React.SetStateAction<LoanTerms>>;
}) {
  const [open, setOpen] = useState(true);
  const update = <K extends keyof LoanTerms>(k: K, v: LoanTerms[K]) =>
    setState((p) => ({ ...p, [k]: v }));

  const calc = useMemo(() => {
    const price = Math.max(0, state.propertyPrice);
    const dp = Math.max(0, state.downPayment);
    const loan = Math.max(0, price - dp);
    const ltv = price > 0 ? (loan / price) * 100 : 0;
    const monthlyPI = monthlyPaymentCAD(loan, state.interestRatePct, state.amortizationYears);

    const liabilities: LiabilityInputs = {
      monthlyMortgagePI: monthlyPI,
      annualPropertyTaxes: state.annualPropertyTaxes,
      monthlyHeating: state.monthlyHeating,
      monthlyCondoFees: state.monthlyCondoFees,
      otherMonthlyDebt:
        state.primaryOtherMonthlyDebt +
        (state.coApplicantEnabled ? state.coOtherMonthlyDebt : 0),
    };
    const householdIncome =
      state.primaryAnnualIncome + (state.coApplicantEnabled ? state.coAnnualIncome : 0);
    const ds = calculateDebtService(householdIncome, liabilities);

    return { price, dp, loan, ltv, monthlyPI, householdIncome, ds };
  }, [state]);

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
              Reactive · drives LTV, P+I, GDS &amp; TDS in real time
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
          {/* ── Property + rate inputs ─────────────────────────────── */}
          <div className="col-span-12 grid grid-cols-2 gap-px bg-border md:grid-cols-4 lg:col-span-8">
            <NumField
              label="Property Price"
              prefix="$"
              value={state.propertyPrice}
              onChange={(v) => update("propertyPrice", v)}
            />
            <NumField
              label="Down Payment"
              prefix="$"
              value={state.downPayment}
              onChange={(v) => update("downPayment", v)}
            />
            <NumField
              label="Contract Rate"
              suffix="%"
              step={0.01}
              value={state.interestRatePct}
              onChange={(v) => update("interestRatePct", v)}
            />
            <NumField
              label="ROE — Return on Equity"
              suffix="%"
              step={0.1}
              value={state.roePct}
              onChange={(v) => update("roePct", v)}
            />
          </div>

          {/* ── Live calc readout ──────────────────────────────────── */}
          <aside className="col-span-12 bg-secondary/40 p-4 lg:col-span-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Live Loan Math
              </span>
              <button
                type="button"
                onClick={() => setState(DEFAULT_LOAN_TERMS)}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="space-y-1 font-mono text-[10.5px]">
              <Row l="Loan Amount" r={fmtCAD(calc.loan)} />
              <Row l="Monthly P+I" r={fmtCAD(calc.monthlyPI)} bold />
              <Row l="Household Income (annual)" r={fmtCAD(calc.householdIncome)} />
              <Row l="LTV" r={`${calc.ltv.toFixed(2)}%`} bold />
              <Row l="GDS / TDS" r={`${calc.ds.gds.toFixed(1)}% / ${calc.ds.tds.toFixed(1)}%`} bold />
            </div>
          </aside>

          {/* ── Amortization slider + term selector ─────────────────── */}
          <div className="col-span-12 bg-card p-5">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="amort"
                  className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Amortization Period
                </label>
                <span className="font-mono text-sm font-bold">
                  {state.amortizationYears} years
                </span>
              </div>
              <input
                id="amort"
                type="range"
                min={5}
                max={30}
                step={5}
                value={state.amortizationYears}
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
                      state.termMonths === t.months
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

          {/* ── Primary applicant ───────────────────────────────────── */}
          <div className="col-span-12 grid grid-cols-2 gap-px bg-border md:grid-cols-5 lg:col-span-12">
            <NumField
              label="Primary Annual Income"
              prefix="$"
              value={state.primaryAnnualIncome}
              onChange={(v) => update("primaryAnnualIncome", v)}
            />
            <NumField
              label="Primary Other Monthly Debt"
              prefix="$"
              value={state.primaryOtherMonthlyDebt}
              onChange={(v) => update("primaryOtherMonthlyDebt", v)}
            />
            <NumField
              label="Annual Property Tax"
              prefix="$"
              value={state.annualPropertyTaxes}
              onChange={(v) => update("annualPropertyTaxes", v)}
            />
            <NumField
              label="Monthly Heating"
              prefix="$"
              value={state.monthlyHeating}
              onChange={(v) => update("monthlyHeating", v)}
            />
            <NumField
              label="Monthly Condo / Strata"
              prefix="$"
              value={state.monthlyCondoFees}
              onChange={(v) => update("monthlyCondoFees", v)}
            />
          </div>

          {/* ── Co-applicant toggle + linked fields ──────────────────── */}
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
                  checked={state.coApplicantEnabled}
                  onChange={(e) => update("coApplicantEnabled", e.target.checked)}
                  className="peer sr-only"
                />
                <span className="block h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                <span className="absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>

            {state.coApplicantEnabled && (
              <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
                <NumField
                  label="Co-Applicant Annual Income"
                  prefix="$"
                  value={state.coAnnualIncome}
                  onChange={(v) => update("coAnnualIncome", v)}
                />
                <NumField
                  label="Co-Applicant Other Monthly Debt"
                  prefix="$"
                  value={state.coOtherMonthlyDebt}
                  onChange={(v) => update("coOtherMonthlyDebt", v)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// primitives
// ─────────────────────────────────────────────────────────────────────────────

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
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
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
