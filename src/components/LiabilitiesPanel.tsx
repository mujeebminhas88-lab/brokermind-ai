import { useState } from "react";
import { ChevronDown, Building2, RotateCcw } from "lucide-react";
import {
  DEFAULT_LIABILITIES,
  type LiabilityInputs,
  type DebtServiceResult,
  fmtCAD,
} from "@/utils/debtService";

export { DEFAULT_LIABILITIES };
export type { LiabilityInputs };

export function LiabilitiesPanel({
  liabilities,
  setLiabilities,
  result,
}: {
  liabilities: LiabilityInputs;
  setLiabilities: React.Dispatch<React.SetStateAction<LiabilityInputs>>;
  result: DebtServiceResult;
}) {
  const [open, setOpen] = useState(true);

  const update = (k: keyof LiabilityInputs, v: number) =>
    setLiabilities((prev) => ({ ...prev, [k]: Number.isFinite(v) ? v : 0 }));

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
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                04
              </span>
              <h2 className="text-[13px] font-bold tracking-tight">
                Subject Property &amp; Liabilities Ingestion
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Reactive GDS / TDS engine · OSFI B-20 stress-tested
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <RatioPill label="GDS" value={result.gds} cap={result.gdsCap} exceeded={result.gdsExceeded} />
          <RatioPill label="TDS" value={result.tds} cap={result.tdsCap} exceeded={result.tdsExceeded} />
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-12 gap-px border-t border-border bg-border">
          <div className="col-span-12 grid grid-cols-1 gap-px bg-border md:grid-cols-5 lg:col-span-9">
            <CurrencyField
              label="Proposed Monthly P+I"
              hint="Stress-tested qualifying rate"
              value={liabilities.monthlyMortgagePI}
              onChange={(v) => update("monthlyMortgagePI", v)}
            />
            <CurrencyField
              label="Annual Property Taxes"
              hint="Total municipal levy"
              value={liabilities.annualPropertyTaxes}
              onChange={(v) => update("annualPropertyTaxes", v)}
            />
            <CurrencyField
              label="Monthly Heating"
              hint="CMHC minimum applies"
              value={liabilities.monthlyHeating}
              onChange={(v) => update("monthlyHeating", v)}
            />
            <CurrencyField
              label="Monthly Condo / Strata"
              hint="50% counted toward GDS"
              value={liabilities.monthlyCondoFees}
              onChange={(v) => update("monthlyCondoFees", v)}
            />
            <CurrencyField
              label="Other Monthly Debts"
              hint="Cards, LOCs, auto loans"
              value={liabilities.otherMonthlyDebt}
              onChange={(v) => update("otherMonthlyDebt", v)}
            />
          </div>

          <div className="col-span-12 bg-secondary/40 p-4 lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Live Calculation
              </span>
              <button
                type="button"
                onClick={() => setLiabilities(DEFAULT_LIABILITIES)}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="space-y-1 font-mono text-[10.5px]">
              <CalcRow l="Monthly Qualifying Income" r={fmtCAD(result.monthlyIncome)} />
              <CalcRow l="GDS Numerator" r={fmtCAD(result.gdsNumerator)} bold />
              <CalcRow l="TDS Numerator" r={fmtCAD(result.tdsNumerator)} bold />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RatioPill({
  label,
  value,
  cap,
  exceeded,
}: {
  label: string;
  value: number;
  cap: number;
  exceeded: boolean;
}) {
  const style = exceeded
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
      <span>{value.toFixed(1)}%</span>
      <span className="opacity-60">/ {cap.toFixed(1)}%</span>
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
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-transparent font-mono text-[14px] font-bold tracking-tight outline-none focus:text-foreground"
        />
      </div>
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
