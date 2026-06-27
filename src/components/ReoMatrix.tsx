import { Building, Plus, Trash2 } from "lucide-react";
import {
  useApplicationStore,
  useDerivedFinancials,
  type ReoProperty,
  type LenderStream,
} from "@/store/applicationStore";

export type { LenderStream, ReoProperty } from "@/store/applicationStore";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  // Optional overrides — by default the panel binds directly to the global store.
  lenderStream?: LenderStream;
  onStreamChange?: (s: LenderStream) => void;
  disabled?: boolean;
}

export function ReoMatrix({ disabled, lenderStream: lenderStreamProp, onStreamChange }: Props) {
  const rows = useApplicationStore((s) => s.reo);
  const storeStream = useApplicationStore((s) => s.lenderStream);
  const setStreamStore = useApplicationStore((s) => s.setLenderStream);
  const updateReo = useApplicationStore((s) => s.updateReo);
  const removeReo = useApplicationStore((s) => s.removeReo);
  const addReo = useApplicationStore((s) => s.addReo);
  const lenderStream = lenderStreamProp ?? storeStream;

  const setStream = (s: LenderStream) => {
    setStreamStore(s);
    onStreamChange?.(s);
  };

  const { reoTotals: totals, rentalContribution } = useDerivedFinancials();

  const update = (id: string, patch: Partial<ReoProperty>) => !disabled && updateReo(id, patch);
  const remove = (id: string) => !disabled && removeReo(id);
  const add = () => !disabled && addReo();

  return (
    <div className="w-full border border-border bg-card rounded-sm shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary/30 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-sm">
            <Building className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">REO Matrix · Real Estate Owned Portfolio</h3>
            <p className="text-[11px] text-muted-foreground">
              Bound to global store · {lenderStream === "A" ? "Gross Add-back (50%)" : "Net Rental Offset (Rent − PITH − Carry)"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Lender Stream</span>
          <div className="flex rounded-sm border border-border overflow-hidden">
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                disabled={disabled}
                onClick={() => setStream(s)}
                className={`px-3 py-1 text-xs font-semibold ${
                  lenderStream === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}-Lender
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Property Address</th>
              <th className="text-right px-2 py-2 font-medium">Market Value</th>
              <th className="text-right px-2 py-2 font-medium">Mortgage Bal.</th>
              <th className="text-right px-2 py-2 font-medium">Monthly Rent</th>
              <th className="text-right px-2 py-2 font-medium">Prop Tax (yr)</th>
              <th className="text-right px-2 py-2 font-medium">Insurance (yr)</th>
              <th className="text-right px-2 py-2 font-medium">Heat (yr)</th>
              <th className="text-center px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-1.5">
                  <input
                    value={p.address}
                    disabled={disabled}
                    onChange={(e) => update(p.id, { address: e.target.value })}
                    className="w-full bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-ring rounded-sm px-1 py-0.5"
                    placeholder="123 Main St"
                  />
                </td>
                {(
                  [
                    ["marketValue", p.marketValue],
                    ["mortgageBalance", p.freeAndClear ? 0 : p.mortgageBalance],
                    ["monthlyRent", p.monthlyRent],
                    ["propertyTax", p.propertyTax],
                    ["insurance", p.insurance],
                    ["heating", p.heating],
                  ] as const
                ).map(([k, v]) => (
                  <td key={k} className="px-1 py-1.5">
                    <input
                      type="number"
                      value={v}
                      disabled={disabled || (k === "mortgageBalance" && p.freeAndClear)}
                      onChange={(e) => update(p.id, { [k]: Number(e.target.value) || 0 } as Partial<ReoProperty>)}
                      className="w-full text-right font-mono bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-ring rounded-sm px-1 py-0.5 disabled:text-muted-foreground"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => update(p.id, { freeAndClear: !p.freeAndClear })}
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                      p.freeAndClear
                        ? "bg-success/10 text-success border-success/40"
                        : "bg-warning-bg text-warning-fg border-warning/40"
                    }`}
                  >
                    {p.freeAndClear ? "Free & Clear" : "Mortgaged"}
                  </button>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => remove(p.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-2.5 bg-secondary/20">
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add Property
        </button>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-1 text-[11px] font-mono">
          <Metric label="Portfolio Value" value={fmt(totals.value)} />
          <Metric label="Aggregate Debt" value={fmt(totals.debt)} />
          <Metric label="Portfolio LTV" value={`${totals.ltv.toFixed(1)}%`} />
          <Metric label="Gross Rents" value={fmt(totals.gross)} />
          <Metric
            label={lenderStream === "A" ? "Add-back to Income" : "Net Rental Offset"}
            value={fmt(rentalContribution)}
            highlight
          />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
