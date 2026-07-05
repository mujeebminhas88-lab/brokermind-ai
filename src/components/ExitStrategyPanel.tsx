/**
 * Private Lender Exit Strategy — NEW-J
 * Auto-visible when computed lender suitability = Private.
 */
import { useMemo } from "react";
import { LogOut, Calendar, Calculator } from "lucide-react";
import {
  useExitStrategyStore,
  holdingInterest,
  feesTotal,
  monthsToLtv80,
  type ExitRoute,
} from "@/store/exitStrategyStore";
import { useDerivedFinancials, useApplicationStore } from "@/store/applicationStore";
import { useCreditProfileStore } from "@/store/creditProfileStore";
import { usePropertyStore, analyzeEligibility } from "@/store/propertyStore";
import { computeSuitability } from "@/utils/lenderSuitability";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const selectCls = inputCls;
const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function ExitStrategyPanel({ visible: visibleProp }: { visible?: boolean } = {}) {
  const st = useExitStrategyStore();
  const financials = useDerivedFinancials();
  const loan = useApplicationStore((s) => s.loan);
  const credit = useCreditProfileStore();
  const property = usePropertyStore();

  const effectiveLoan = st.loanAmount > 0 ? st.loanAmount : Math.max(0, loan.propertyPrice - loan.downPayment);

  const interestCost = useMemo(
    () => holdingInterest(effectiveLoan, st.privateRatePct, st.termMonths),
    [effectiveLoan, st.privateRatePct, st.termMonths],
  );
  const fees = useMemo(
    () => feesTotal(effectiveLoan, st.lenderFeePct, st.brokerFeePct),
    [effectiveLoan, st.lenderFeePct, st.brokerFeePct],
  );

  // A-lender eligibility date from derog seasoning
  const aLenderEligibility = useMemo(() => {
    const dates: Date[] = [];
    if (credit.bankruptcyDischargeDate) {
      const d = new Date(credit.bankruptcyDischargeDate);
      d.setFullYear(d.getFullYear() + 2);
      dates.push(d);
    }
    if (credit.consumerProposalCompletionDate) {
      const d = new Date(credit.consumerProposalCompletionDate);
      d.setFullYear(d.getFullYear() + 3);
      dates.push(d);
    }
    if (dates.length === 0) return null;
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    const monthsAway = (latest.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
    return { date: latest, monthsAway };
  }, [credit.bankruptcyDischargeDate, credit.consumerProposalCompletionDate]);

  // Months until LTV crosses 80% via appreciation
  const currentValue = property.appraisedValue ?? loan.propertyPrice;
  const currentDebt = effectiveLoan;
  const monthsToRefi = monthsToLtv80(currentValue, currentDebt, st.estimatedAppreciationPct);

  const elig = useMemo(
    () => analyzeEligibility(property, loan.propertyPrice, loan.amortizationYears),
    [property, loan.propertyPrice, loan.amortizationYears],
  );
  const suitabilityTier = useMemo(
    () => computeSuitability(credit, financials, elig, null).tier,
    [credit, financials, elig],
  );
  const visible = visibleProp ?? suitabilityTier === "Private";
  if (!visible) return null;

  return (
    <section id="exit-strategy" className="scroll-mt-24 rounded-sm border border-destructive/30 bg-destructive/5 p-5">
      <header className="flex items-center justify-between border-b border-destructive/20 pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <LogOut className="h-4 w-4 text-destructive" />
            Private Lender Exit Strategy
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            MANDATORY for Private/MIC submissions — describes how the borrower refinances out.
          </p>
        </div>
      </header>

      {/* Route + trigger */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Exit Route">
          <select className={selectCls} value={st.route} onChange={(e) => st.patch({ route: e.target.value as ExitRoute })}>
            <option>Refinance to A Lender</option>
            <option>Refinance to B Lender</option>
            <option>Sale of Property</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Target Exit Date">
          <input type="date" className={inputCls} value={st.targetDate} onChange={(e) => st.patch({ targetDate: e.target.value })} />
        </Field>
        <Field label="Term (months)">
          <input type="number" className={inputCls} value={st.termMonths} onChange={(e) => st.patch({ termMonths: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Trigger Event (what needs to happen to refinance)">
          <textarea
            className="w-full rounded-sm border border-input bg-background p-2 text-xs"
            rows={2}
            value={st.triggerEvent}
            onChange={(e) => st.patch({ triggerEvent: e.target.value })}
            placeholder="E.g. Bankruptcy seasoned 2y; Beacon rebuilt to 660; income re-verified for 24 months."
          />
        </Field>
      </div>

      {/* Qualification timeline */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-sm border border-border/60 bg-background/60 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> A-Lender Eligibility Date
          </div>
          {aLenderEligibility ? (
            <>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                {aLenderEligibility.date.toLocaleDateString("en-CA")}
              </div>
              <div className="text-[11px] text-muted-foreground">
                ~{Math.max(0, aLenderEligibility.monthsAway).toFixed(1)} months from today (per derog seasoning).
              </div>
            </>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">No derogatory seasoning constraint on record.</div>
          )}
        </div>
        <div className="rounded-sm border border-border/60 bg-background/60 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> LTV reaches 80% (appreciation only)
          </div>
          <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Appr. %/yr</span>
            <input
              type="number"
              step="0.1"
              className={inputCls}
              value={st.estimatedAppreciationPct}
              onChange={(e) => st.patch({ estimatedAppreciationPct: Number(e.target.value) })}
            />
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-foreground">
            {monthsToRefi == null ? "—" : monthsToRefi <= 0 ? "Already ≤ 80%" : `${monthsToRefi.toFixed(1)} months`}
          </div>
        </div>
      </div>

      {/* Holding cost */}
      <div className="mt-5 rounded-sm border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" /> Holding Cost Calculator
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Private Rate (%)">
            <input type="number" step="0.01" className={inputCls} value={st.privateRatePct} onChange={(e) => st.patch({ privateRatePct: Number(e.target.value) })} />
          </Field>
          <Field label="Loan Amount (0 = derived)">
            <input type="number" className={inputCls} value={st.loanAmount} onChange={(e) => st.patch({ loanAmount: Number(e.target.value) })} />
          </Field>
          <Field label="Lender Fee %">
            <input type="number" step="0.1" className={inputCls} value={st.lenderFeePct} onChange={(e) => st.patch({ lenderFeePct: Number(e.target.value) })} />
          </Field>
          <Field label="Broker Fee %">
            <input type="number" step="0.1" className={inputCls} value={st.brokerFeePct} onChange={(e) => st.patch({ brokerFeePct: Number(e.target.value) })} />
          </Field>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Stat label={`Interest × ${st.termMonths}m`} value={money(interestCost)} />
          <Stat label="Lender + Broker Fees" value={money(fees)} />
          <Stat label="Total Cost to Exit" value={money(interestCost + fees)} accent />
        </div>

        <p className="mt-3 text-[11px] italic text-muted-foreground">
          Client pays <strong className="text-foreground">{money(interestCost + fees)}</strong> in private
          holding cost to clear derogatory items and refinance to A/B lending — compare against opportunity
          cost of delaying purchase.
        </p>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-sm border p-2 ${accent ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-bold ${accent ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
