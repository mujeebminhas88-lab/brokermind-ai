import { useDerivedFinancials } from "@/store/applicationStore";
import { useUnderwritingConfigStore } from "@/store/underwritingConfigStore";
import type { CmhcInsurer, PropertyType } from "@/utils/underwritingEngine";
import { ShieldCheck, ShieldAlert } from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function CmhcPanel() {
  const derived = useDerivedFinancials();
  const cfg = useUnderwritingConfigStore();
  const { cmhc } = derived;

  if (!cmhc.applicable) {
    return (
      <section id="cmhc-panel" className="scroll-mt-24 rounded-sm border border-border bg-card p-4 text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-success" />
        LTV {cmhc.ltvPct.toFixed(1)}% — CMHC insurance not required (conventional mortgage).
      </section>
    );
  }

  return (
    <section id="cmhc-panel" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            CMHC / Insured Mortgage
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            LTV {cmhc.ltvPct.toFixed(2)}% — insurance mandatory (LTV &gt; 80%).
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            cmhc.eligible ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {cmhc.eligible ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {cmhc.eligible ? "Eligible" : "Ineligible"}
        </span>
      </header>

      {!cmhc.eligible && (
        <div className="mt-4 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <strong>Not eligible for default insurance:</strong> {cmhc.ineligibleReason}
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Property Type
          </span>
          <select
            value={cfg.propertyType}
            onChange={(e) => cfg.patch({ propertyType: e.target.value as PropertyType })}
            className={selectCls}
          >
            <option value="owner-occupied">Owner-Occupied</option>
            <option value="rental">Rental (Not CMHC-eligible)</option>
            <option value="second-home">Second Home (Not CMHC-eligible)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Insurer (rates identical)
          </span>
          <select
            value={cfg.cmhcInsurer}
            onChange={(e) => cfg.patch({ cmhcInsurer: e.target.value as CmhcInsurer })}
            className={selectCls}
          >
            <option>CMHC</option>
            <option>Sagen</option>
            <option>Canada Guaranty</option>
          </select>
        </label>
      </div>

      {cmhc.eligible && (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Stat label="Premium Rate" value={`${cmhc.premiumRatePct.toFixed(2)}%`} />
          <Stat label="Premium Amount" value={money(cmhc.premiumAmount)} />
          <Stat label="Insured Mortgage" value={money(cmhc.insuredMortgage)} accent />
        </div>
      )}

      {cmhc.eligible && (
        <div className="mt-3 rounded-sm border border-border bg-muted/30 p-3 text-xs text-foreground">
          Monthly P+I is calculated on the <strong>insured mortgage amount</strong> (
          {money(cmhc.insuredMortgage)}), which flows into GDS/TDS.
        </div>
      )}
    </section>
  );
}

const selectCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-sm border p-2 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}
