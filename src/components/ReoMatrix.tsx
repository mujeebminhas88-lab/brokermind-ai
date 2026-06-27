import { useMemo, useState } from "react";
import { Building, Plus, Trash2 } from "lucide-react";

export type LenderStream = "A" | "B";

export interface ReoProperty {
  id: string;
  address: string;
  marketValue: number;
  mortgageBalance: number;
  monthlyRent: number;
  propertyTax: number;
  insurance: number;
  heating: number;
  freeAndClear: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SEED: ReoProperty[] = [
  {
    id: uid(),
    address: "142 Roehampton Ave, Toronto ON",
    marketValue: 925000,
    mortgageBalance: 612000,
    monthlyRent: 3200,
    propertyTax: 4800,
    insurance: 1450,
    heating: 1800,
    freeAndClear: false,
  },
  {
    id: uid(),
    address: "88 Stonebridge Blvd, Mississauga ON",
    marketValue: 720000,
    mortgageBalance: 0,
    monthlyRent: 2650,
    propertyTax: 4100,
    insurance: 1280,
    heating: 1500,
    freeAndClear: true,
  },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  lenderStream: LenderStream;
  onStreamChange: (s: LenderStream) => void;
  disabled?: boolean;
}

export function ReoMatrix({ lenderStream, onStreamChange, disabled }: Props) {
  const [rows, setRows] = useState<ReoProperty[]>(SEED);

  const update = (id: string, patch: Partial<ReoProperty>) => {
    if (disabled) return;
    setRows((r) => r.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const remove = (id: string) => !disabled && setRows((r) => r.filter((p) => p.id !== id));
  const add = () =>
    !disabled &&
    setRows((r) => [
      ...r,
      {
        id: uid(),
        address: "",
        marketValue: 0,
        mortgageBalance: 0,
        monthlyRent: 0,
        propertyTax: 0,
        insurance: 0,
        heating: 0,
        freeAndClear: false,
      },
    ]);

  const totals = useMemo(() => {
    let value = 0,
      debt = 0,
      gross = 0,
      pith = 0,
      addBack = 0,
      offset = 0;
    for (const p of rows) {
      const monthlyPith = (p.propertyTax + p.insurance + p.heating) / 12;
      const annualRent = p.monthlyRent * 12;
      value += p.marketValue;
      debt += p.freeAndClear ? 0 : p.mortgageBalance;
      gross += annualRent;
      pith += monthlyPith * 12;
      // A-Lender: Gross Add-back (50% of gross rents added to income)
      addBack += annualRent * 0.5;
      // B-Lender: Net Rental Offset (rent - PITH - mortgage estimate; net offsets debt service)
      const annualPI = p.freeAndClear ? 0 : p.mortgageBalance * 0.06; // 6% est carrying
      offset += annualRent - monthlyPith * 12 - annualPI;
    }
    const ltv = value > 0 ? (debt / value) * 100 : 0;
    return { value, debt, gross, pith, addBack, offset, ltv };
  }, [rows]);

  const rentalContribution = lenderStream === "A" ? totals.addBack : totals.offset;

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
              Rental income method: {lenderStream === "A" ? "Gross Add-back (50%)" : "Net Rental Offset (Rent − PITH − Carry)"}
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
                onClick={() => onStreamChange(s)}
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
