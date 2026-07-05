import { useApplicationStore, useDerivedFinancials } from "@/store/applicationStore";
import { useUnderwritingConfigStore } from "@/store/underwritingConfigStore";
import type { RentalOffsetRule, PropertyRole } from "@/utils/underwritingEngine";
import { Home } from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

const RULE_LABEL: Record<RentalOffsetRule, string> = {
  "50-offset": "50% Offset (most A lenders)",
  "80-add": "80% Add-Back (some Alt lenders)",
  "100-add": "100% Add-Back (Private only)",
};

const ROLE_LABEL: Record<PropertyRole, string> = {
  subject: "Subject (Purchasing)",
  investment: "Investment",
  "principal-selling": "Principal Being Sold",
};

export function RentalOffsetPanel() {
  const cfg = useUnderwritingConfigStore();
  const reo = useApplicationStore((s) => s.reo);
  const updateReo = useApplicationStore((s) => s.updateReo);
  const derived = useDerivedFinancials();

  return (
    <section id="rental-offset" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="border-b border-border pb-3">
        <h2 className="font-display text-base font-bold tracking-tight text-foreground">
          Rental Income Offset Treatment
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Applies to non-subject rental properties. Subject property must qualify on full PITH.
        </p>
      </header>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Offset Rule
          </span>
          <select
            value={cfg.rentalOffsetRule}
            onChange={(e) => cfg.patch({ rentalOffsetRule: e.target.value as RentalOffsetRule })}
            className={selectCls}
          >
            {(Object.keys(RULE_LABEL) as RentalOffsetRule[]).map((r) => (
              <option key={r} value={r}>
                {RULE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-6 flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={cfg.vacancyFactor}
            onChange={(e) => cfg.patch({ vacancyFactor: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          Apply 5% vacancy factor to gross rents
        </label>
      </div>

      <div className="mt-4 rounded-sm border border-border bg-muted/30 p-3 text-xs text-foreground">
        Rental contribution to qualifying income:{" "}
        <span className="font-mono font-bold">{money(derived.rentalContribution)}</span> annually
      </div>

      {reo.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No REO properties. Add investment properties in the REO Matrix to apply offset.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Address</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3 text-right">Monthly Rent</th>
              </tr>
            </thead>
            <tbody>
              {reo.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground">
                    <Home className="mr-1 inline h-3 w-3 text-muted-foreground" />
                    {p.address || <span className="text-muted-foreground">(no address)</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={p.propertyRole}
                      onChange={(e) => updateReo(p.id, { propertyRole: e.target.value as PropertyRole })}
                      className="rounded-sm border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {(Object.keys(ROLE_LABEL) as PropertyRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-foreground">
                    {money(p.monthlyRent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const selectCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
