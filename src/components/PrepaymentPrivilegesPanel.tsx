/**
 * Pre-Payment Privileges Panel — NEW-G
 * Product prepayment terms + indicative penalty + side-by-side comparison.
 */
import { useMemo } from "react";
import { Percent, Repeat, Plus, X } from "lucide-react";
import {
  usePrepaymentStore,
  indicativePenalty,
  type PenaltyMethod,
  type RateKind,
} from "@/store/prepaymentStore";
import { useApplicationStore } from "@/store/applicationStore";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const selectCls = inputCls;
const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function PrepaymentPrivilegesPanel() {
  const st = usePrepaymentStore();
  const loan = useApplicationStore((s) => s.loan);

  const outstandingBalance = Math.max(0, loan.propertyPrice - loan.downPayment);
  const monthsRemaining = loan.termMonths;

  const penalty = useMemo(
    () =>
      indicativePenalty({
        balance: outstandingBalance,
        contractRatePct: loan.interestRatePct,
        comparisonRatePct: st.comparisonRatePct,
        monthsRemaining,
        method: st.rateKind === "Variable" ? "3-Month Interest" : st.penaltyMethod,
      }),
    [outstandingBalance, loan.interestRatePct, st.comparisonRatePct, monthsRemaining, st.rateKind, st.penaltyMethod],
  );

  return (
    <section id="prepayment" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Pre-Payment Privileges & Penalty
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Document product terms · Indicative penalty math · Product comparison
          </p>
        </div>
      </header>

      {/* Primary privileges */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Annual Lump Sum (% of original)">
          <input
            type="number"
            className={inputCls}
            value={st.primary.lumpSumPct}
            onChange={(e) => st.patchPrimary({ lumpSumPct: Number(e.target.value) })}
          />
        </Field>
        <Field label="Annual Payment Increase (%)">
          <input
            type="number"
            className={inputCls}
            value={st.primary.paymentIncreasePct}
            onChange={(e) => st.patchPrimary({ paymentIncreasePct: Number(e.target.value) })}
          />
        </Field>
        <Field label="Rate Kind">
          <select
            className={selectCls}
            value={st.rateKind}
            onChange={(e) => st.patch({ rateKind: e.target.value as RateKind })}
          >
            <option>Fixed</option>
            <option>Variable</option>
          </select>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <Toggle checked={st.primary.doubleUp} onChange={(v) => st.patchPrimary({ doubleUp: v })} label="Double-up payment" />
        <Toggle checked={st.primary.portability} onChange={(v) => st.patchPrimary({ portability: v })} label="Portable" />
        <Toggle checked={st.primary.assumability} onChange={(v) => st.patchPrimary({ assumability: v })} label="Assumable" />
      </div>

      {/* Penalty calculator */}
      <div className="mt-5 rounded-sm border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Indicative Break Penalty
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Penalty Method">
            <select
              className={selectCls}
              value={st.rateKind === "Variable" ? "3-Month Interest" : st.penaltyMethod}
              disabled={st.rateKind === "Variable"}
              onChange={(e) => st.patch({ penaltyMethod: e.target.value as PenaltyMethod })}
            >
              <option>IRD</option>
              <option>3-Month Interest</option>
            </select>
          </Field>
          <Field label="Comparison Rate (%)">
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={st.comparisonRatePct}
              onChange={(e) => st.patch({ comparisonRatePct: Number(e.target.value) })}
            />
          </Field>
          <div className="rounded-sm border border-primary/40 bg-primary/5 p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estimated Penalty (Today)
            </div>
            <div className="mt-0.5 font-mono text-lg font-bold text-primary">≈ {money(penalty)}</div>
            <div className="mt-0.5 text-[10px] italic text-muted-foreground">
              Indicative — confirm with lender
            </div>
          </div>
        </div>
      </div>

      {/* Comparison products */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Product Comparison ({st.products.length})
          </div>
          <button
            onClick={() => st.addProduct()}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            <Plus className="h-3 w-3" /> Add Product
          </button>
        </div>
        {st.products.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            <Repeat className="mx-auto mb-1 h-4 w-4" />
            Compare 2–3 products side by side to demonstrate value beyond rate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Lender</th>
                  <th className="p-2 text-left">Rate</th>
                  <th className="p-2 text-left">Kind</th>
                  <th className="p-2 text-left">Term</th>
                  <th className="p-2 text-left">Lump %</th>
                  <th className="p-2 text-left">Inc %</th>
                  <th className="p-2 text-left">Port</th>
                  <th className="p-2 text-left">Penalty</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {st.products.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-1">
                      <input className={inputCls} value={p.lenderName} onChange={(e) => st.updateProduct(p.id, { lenderName: e.target.value })} />
                    </td>
                    <td className="p-1">
                      <input type="number" step="0.01" className={inputCls} value={p.ratePct} onChange={(e) => st.updateProduct(p.id, { ratePct: Number(e.target.value) })} />
                    </td>
                    <td className="p-1">
                      <select className={selectCls} value={p.rateKind} onChange={(e) => st.updateProduct(p.id, { rateKind: e.target.value as RateKind })}>
                        <option>Fixed</option>
                        <option>Variable</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <input type="number" className={inputCls} value={p.termMonths} onChange={(e) => st.updateProduct(p.id, { termMonths: Number(e.target.value) })} />
                    </td>
                    <td className="p-1">
                      <input type="number" className={inputCls} value={p.privileges.lumpSumPct} onChange={(e) => st.updateProduct(p.id, { privileges: { ...p.privileges, lumpSumPct: Number(e.target.value) } })} />
                    </td>
                    <td className="p-1">
                      <input type="number" className={inputCls} value={p.privileges.paymentIncreasePct} onChange={(e) => st.updateProduct(p.id, { privileges: { ...p.privileges, paymentIncreasePct: Number(e.target.value) } })} />
                    </td>
                    <td className="p-1 text-center">
                      <input type="checkbox" checked={p.privileges.portability} onChange={(e) => st.updateProduct(p.id, { privileges: { ...p.privileges, portability: e.target.checked } })} />
                    </td>
                    <td className="p-1">
                      <select className={selectCls} value={p.penaltyMethod} onChange={(e) => st.updateProduct(p.id, { penaltyMethod: e.target.value as PenaltyMethod })}>
                        <option>IRD</option>
                        <option>3-Month Interest</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <button
                        onClick={() => st.removeProduct(p.id)}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
