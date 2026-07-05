import { useDerivedFinancials, useApplicationStore } from "@/store/applicationStore";
import { useUnderwritingConfigStore } from "@/store/underwritingConfigStore";
import type { UnderwritingStream } from "@/utils/underwritingEngine";
import { CheckCircle2, XCircle, Zap } from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function StressTestPanel() {
  const derived = useDerivedFinancials();
  const loan = useApplicationStore((s) => s.loan);
  const cfg = useUnderwritingConfigStore();
  const { stress, ds } = derived;

  return (
    <section id="stress-test" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            OSFI B-20 Stress Test · MQR {stress.qualifyingRatePct.toFixed(2)}%
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Qualifying rate = MAX(contract + 2.00%, 5.25%) · Lender stream: {stress.stream}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-bold uppercase tracking-wider ${
            !stress.requiresStressTest
              ? "bg-muted text-muted-foreground"
              : stress.pass
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
          }`}
        >
          {!stress.requiresStressTest ? (
            "Waived (Private)"
          ) : stress.pass ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Pass
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" /> Fail
            </>
          )}
        </div>
      </header>

      {/* Stream selector */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Lender Stream
        </span>
        {(["Prime", "Alt", "Private"] as UnderwritingStream[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => cfg.patch({ stream: s })}
            className={`rounded-sm border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
              cfg.stream === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Dual ratio display */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-sm border border-border p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            At Contract Rate ({loan.interestRatePct.toFixed(2)}%)
          </div>
          <div className="mt-2 flex gap-4 font-mono">
            <div>
              <div className="text-[10px] text-muted-foreground">GDS</div>
              <div className={`text-xl font-bold ${ds.gdsExceeded ? "text-destructive" : "text-foreground"}`}>
                {ds.gds.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">TDS</div>
              <div className={`text-xl font-bold ${ds.tdsExceeded ? "text-destructive" : "text-foreground"}`}>
                {ds.tds.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Monthly P+I</div>
              <div className="text-xl font-bold text-foreground">{money(derived.monthlyPI)}</div>
            </div>
          </div>
        </div>
        <div className={`rounded-sm border p-3 ${stress.pass ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            At MQR ({stress.qualifyingRatePct.toFixed(2)}%) · Caps {stress.gdsCap}% / {stress.tdsCap}%
          </div>
          <div className="mt-2 flex gap-4 font-mono">
            <div>
              <div className="text-[10px] text-muted-foreground">GDS</div>
              <div className={`text-xl font-bold ${stress.gds > stress.gdsCap ? "text-destructive" : "text-success"}`}>
                {stress.gds.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">TDS</div>
              <div className={`text-xl font-bold ${stress.tds > stress.tdsCap ? "text-destructive" : "text-success"}`}>
                {stress.tds.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Stressed P+I</div>
              <div className="text-xl font-bold text-foreground">{money(stress.monthlyPI)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-sm border border-border bg-muted/30 p-3 text-xs text-foreground">
        Minimum qualifying income to pass stress test:{" "}
        <span className="font-mono font-bold">{money(stress.minQualifyingIncome)}</span>
        {" · current household income: "}
        <span className="font-mono font-bold">{money(derived.householdIncome)}</span>
      </div>

      {/* Scenario what-if */}
      <div className="mt-4 rounded-sm border border-dashed border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3.5 w-3.5" /> Scenario "What-If"
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={cfg.scenarioEnabled}
              onChange={(e) => cfg.patch({ scenarioEnabled: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            Enable
          </label>
        </div>
        <div className={`grid gap-2 md:grid-cols-3 ${cfg.scenarioEnabled ? "" : "opacity-50 pointer-events-none"}`}>
          <NumberField
            label="Loan Amount Override"
            value={cfg.scenarioLoanAmountOverride ?? ""}
            onChange={(v) => cfg.patch({ scenarioLoanAmountOverride: v === "" ? null : Number(v) })}
          />
          <NumberField
            label="Amortization (yrs)"
            value={cfg.scenarioAmortOverride ?? ""}
            onChange={(v) => cfg.patch({ scenarioAmortOverride: v === "" ? null : Number(v) })}
          />
          <NumberField
            label="Household Income"
            value={cfg.scenarioIncomeOverride ?? ""}
            onChange={(v) => cfg.patch({ scenarioIncomeOverride: v === "" ? null : Number(v) })}
          />
        </div>
        {cfg.scenarioEnabled && (
          <button
            type="button"
            onClick={cfg.resetScenario}
            className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Reset scenario
          </button>
        )}
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}
