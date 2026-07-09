/**
 * Prompt 6 addendums — NEW-A (2-year averaging) & NEW-D (T2 add-back).
 *
 * Reads T1 / T2 slips from the tax slip store for the active applicant,
 * computes a qualifying income adjustment, and pushes it into the
 * underwriting config store via the scenarioIncomeOverride channel.
 */
import { useMemo, useEffect } from "react";
import { useTaxSlipStore } from "@/store/taxSlipStore";
import { useUnderwritingConfigStore } from "@/store/underwritingConfigStore";
import { useApplicationStore } from "@/store/applicationStore";
import type { T1, T2 } from "@/utils/taxSlipParser";
import { Calculator, TrendingUp, Building2 } from "lucide-react";

// Stable empty references — returning a fresh `[]` from a Zustand v5 selector
// makes useSyncExternalStore see a new snapshot every render → infinite loop.
const EMPTY_T1S: T1[] = [];
const EMPTY_T2S: T2[] = [];

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

interface Props {
  applicantId: string | null;
}

export function IncomeAdjustmentsPanel({ applicantId }: Props) {
  const cfg = useUnderwritingConfigStore();
  const loan = useApplicationStore((s) => s.loan);
  const t1s = useTaxSlipStore((s) =>
    applicantId ? s.t1sByApplicant[applicantId] ?? EMPTY_T1S : EMPTY_T1S,
  );
  const t2s = useTaxSlipStore((s) =>
    applicantId ? s.t2sByApplicant[applicantId] ?? EMPTY_T2S : EMPTY_T2S,
  );

  // --- NEW-A: 2-year average of Line 15000 (lower-of-2-years fallback) ---
  const sortedT1s = useMemo(
    () => [...t1s].filter((t) => t.line15000TotalIncome > 0).sort((a, b) => b.taxYear - a.taxYear),
    [t1s],
  );
  const last2 = sortedT1s.slice(0, 2);
  const twoYearAverage = last2.length
    ? last2.reduce((s, t) => s + t.line15000TotalIncome, 0) / last2.length
    : 0;
  const lowerOfTwo = last2.length ? Math.min(...last2.map((t) => t.line15000TotalIncome)) : 0;

  // --- NEW-D: T2 add-back — retained earnings + owner comp × ownership ---
  const t2AddBack = useMemo(() => {
    let total = 0;
    for (const t of t2s) {
      const ownership = (t.ownershipPct ?? 100) / 100;
      const netToOwner = Math.max(0, t.netIncomeBeforeTax) * ownership;
      total += netToOwner;
    }
    return total * cfg.t2AddBackPct;
  }, [t2s, cfg.t2AddBackPct]);

  const baseIncome = loan.primaryAnnualIncome + (loan.coApplicantEnabled ? loan.coAnnualIncome : 0);

  const employmentIncome = cfg.useTwoYearAverage && twoYearAverage > 0
    ? (cfg.useLowerYearIncome ? lowerOfTwo : twoYearAverage)
    : baseIncome;

  const adjustedIncome = employmentIncome + (cfg.t2AddBackEnabled ? t2AddBack : 0);

  const anyAdjustment = cfg.useTwoYearAverage || cfg.t2AddBackEnabled;

  // Push into scenario override so deriveFinancials picks it up.
  useEffect(() => {
    if (anyAdjustment) {
      cfg.patch({ scenarioEnabled: true, scenarioIncomeOverride: adjustedIncome });
    } else if (cfg.scenarioIncomeOverride != null && cfg.scenarioLoanAmountOverride == null && cfg.scenarioAmortOverride == null) {
      cfg.patch({ scenarioEnabled: false, scenarioIncomeOverride: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyAdjustment, adjustedIncome]);

  return (
    <section id="income-adjustments" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            Income Adjustments — Averaging &amp; Corporate Add-Back
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Self-employed 2-year averaging (NEW-A) · Incorporated T2 add-back (NEW-D)
          </p>
        </div>
        <Calculator className="h-4 w-4 text-muted-foreground" />
      </header>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* NEW-A */}
        <div className="rounded-sm border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-chart-2" />
              2-Year Income Averaging
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={cfg.useTwoYearAverage}
                onChange={(e) => cfg.patch({ useTwoYearAverage: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              Enable
            </label>
          </div>
          {last2.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No T1s in the Tax Slip Suite for this applicant.
            </p>
          ) : (
            <>
              <div className="mt-3 space-y-1 text-xs">
                {last2.map((t) => (
                  <div key={t.taxYear} className="flex justify-between font-mono">
                    <span className="text-muted-foreground">T1 {t.taxYear} Line 15000</span>
                    <span className="text-foreground">{money(t.line15000TotalIncome)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-mono font-bold">
                  <span className="text-muted-foreground">2-yr average</span>
                  <span className="text-foreground">{money(twoYearAverage)}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-muted-foreground">Lower of 2 years</span>
                  <span className="text-foreground">{money(lowerOfTwo)}</span>
                </div>
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={cfg.useLowerYearIncome}
                  onChange={(e) => cfg.patch({ useLowerYearIncome: e.target.checked })}
                  disabled={!cfg.useTwoYearAverage}
                  className="h-3 w-3"
                />
                Use lower of two years (conservative)
              </label>
            </>
          )}
        </div>

        {/* NEW-D */}
        <div className="rounded-sm border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-chart-4" />
              T2 Corporate Add-Back
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={cfg.t2AddBackEnabled}
                onChange={(e) => cfg.patch({ t2AddBackEnabled: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              Enable
            </label>
          </div>
          {t2s.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No T2 corporate returns for this applicant.
            </p>
          ) : (
            <>
              <div className="mt-3 space-y-1 text-xs">
                {t2s.map((t, i) => (
                  <div key={i} className="flex justify-between font-mono">
                    <span className="text-muted-foreground">
                      {t.corporationName || "Corp"} {t.taxYear} · {t.ownershipPct}%
                    </span>
                    <span className="text-foreground">
                      {money(Math.max(0, t.netIncomeBeforeTax) * ((t.ownershipPct ?? 100) / 100))}
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-mono font-bold">
                  <span className="text-muted-foreground">Owner-attributable NIBT</span>
                  <span className="text-foreground">{money(t2AddBack / cfg.t2AddBackPct)}</span>
                </div>
              </div>
              <label className="mt-3 block text-[11px] text-muted-foreground">
                Add-back factor
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={cfg.t2AddBackPct}
                  onChange={(e) => cfg.patch({ t2AddBackPct: Number(e.target.value) })}
                  disabled={!cfg.t2AddBackEnabled}
                  className="w-full accent-chart-4"
                />
                <span className="font-mono">{(cfg.t2AddBackPct * 100).toFixed(0)}%</span>
              </label>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-sm border border-primary/40 bg-primary/5 p-3 text-xs">
        <div className="flex justify-between font-mono">
          <span className="text-muted-foreground">Base employment income</span>
          <span className="text-foreground">{money(baseIncome)}</span>
        </div>
        {cfg.useTwoYearAverage && (
          <div className="flex justify-between font-mono">
            <span className="text-muted-foreground">→ Averaged</span>
            <span className="text-foreground">{money(employmentIncome)}</span>
          </div>
        )}
        {cfg.t2AddBackEnabled && (
          <div className="flex justify-between font-mono">
            <span className="text-muted-foreground">+ T2 add-back</span>
            <span className="text-chart-4">{money(t2AddBack)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-mono text-sm font-bold">
          <span>Adjusted qualifying income</span>
          <span className="text-primary">{money(adjustedIncome)}</span>
        </div>
        {!anyAdjustment && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Enable an adjustment above to override the household income used in GDS/TDS.
          </p>
        )}
      </div>
    </section>
  );
}
