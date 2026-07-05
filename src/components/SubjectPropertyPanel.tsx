/**
 * Subject Property Panel — NEW-E + NEW-F
 * Property details, condo/leasehold, appraisal, rural/multi-unit flags,
 * and lender eligibility summary.
 */
import { useMemo } from "react";
import { Home, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  usePropertyStore,
  analyzeEligibility,
  type Tenure,
  type PropertyKind,
  type HeatingType,
  type Condition,
  type AppraisalStatus,
  type DepreciationStatus,
  type StreamEligibility,
} from "@/store/propertyStore";
import { useApplicationStore } from "@/store/applicationStore";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const selectCls = inputCls;
const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

const streamColor: Record<StreamEligibility, string> = {
  eligible: "bg-success/10 text-success border-success/40",
  restricted: "bg-warning-bg text-warning-fg border-warning/40",
  ineligible: "bg-destructive/10 text-destructive border-destructive/40",
};
const streamIcon = (e: StreamEligibility) =>
  e === "ineligible" ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />;

export function SubjectPropertyPanel() {
  const p = usePropertyStore();
  const loan = useApplicationStore((s) => s.loan);
  const eligibility = useMemo(
    () => analyzeEligibility(p, loan.propertyPrice, loan.amortizationYears),
    [p, loan.propertyPrice, loan.amortizationYears],
  );

  const isCondo = p.kind === "Condo" || p.tenure === "Condo Freehold" || p.tenure === "Condo Leasehold";
  const isLeasehold = p.tenure === "Leasehold" || p.tenure === "Condo Leasehold";
  const isRural = p.kind === "Rural";
  const isMultiUnit = p.kind === "Multi-unit" || (p.numUnits ?? 0) >= 3;
  const pre1950 = p.yearBuilt != null && p.yearBuilt < 1950;
  const oilHeat = p.heating === "Oil";
  const belowAvg = p.condition === "Below Average";
  const appraisalLow =
    p.appraisedValue != null && loan.propertyPrice > 0 && p.appraisedValue < loan.propertyPrice;

  return (
    <section id="subject-property" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            Subject Property Details
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Property characteristics · Appraisal · Lender restriction flags
          </p>
        </div>
      </header>

      {/* Address */}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Field label="Street">
          <input className={inputCls} value={p.street} onChange={(e) => p.patch({ street: e.target.value })} />
        </Field>
        <Field label="City">
          <input className={inputCls} value={p.city} onChange={(e) => p.patch({ city: e.target.value })} />
        </Field>
        <Field label="Province">
          <input className={inputCls} value={p.province} onChange={(e) => p.patch({ province: e.target.value })} />
        </Field>
        <Field label="Postal Code">
          <input className={inputCls} value={p.postal} onChange={(e) => p.patch({ postal: e.target.value })} />
        </Field>
      </div>

      {/* Classification */}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="Tenure">
          <select className={selectCls} value={p.tenure} onChange={(e) => p.patch({ tenure: e.target.value as Tenure })}>
            <option>Freehold</option>
            <option>Leasehold</option>
            <option>Condo Freehold</option>
            <option>Condo Leasehold</option>
          </select>
        </Field>
        <Field label="Property Type">
          <select className={selectCls} value={p.kind} onChange={(e) => p.patch({ kind: e.target.value as PropertyKind })}>
            <option>Detached</option>
            <option>Semi-detached</option>
            <option>Townhouse</option>
            <option>Condo</option>
            <option>Multi-unit</option>
            <option>Rural</option>
          </select>
        </Field>
        <Field label="Year Built">
          <input
            type="number"
            className={inputCls}
            value={p.yearBuilt ?? ""}
            onChange={(e) => p.patch({ yearBuilt: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
      </div>

      {/* Condition & heating */}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="Heating">
          <select className={selectCls} value={p.heating} onChange={(e) => p.patch({ heating: e.target.value as HeatingType })}>
            <option value="">—</option>
            <option>Gas</option>
            <option>Electric</option>
            <option>Oil</option>
            <option>Wood</option>
          </select>
        </Field>
        <Field label="Condition">
          <select className={selectCls} value={p.condition} onChange={(e) => p.patch({ condition: e.target.value as Condition })}>
            <option value="">—</option>
            <option>Good</option>
            <option>Average</option>
            <option>Below Average</option>
          </select>
        </Field>
        <Field label="# Units (if multi)">
          <input
            type="number"
            className={inputCls}
            value={p.numUnits ?? ""}
            onChange={(e) => p.patch({ numUnits: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
      </div>

      {/* Age/condition flags */}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {pre1950 && <Flag tone="warn">Pre-1950 construction — additional lender requirements</Flag>}
        {oilHeat && <Flag tone="warn">Oil-heated — restricted by most A lenders</Flag>}
        {belowAvg && <Flag tone="warn">Below Average condition — appraisal required</Flag>}
      </div>

      {/* Condo-specific */}
      {isCondo && (
        <div className="mt-4 rounded-sm border border-border/60 bg-muted/20 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Condo Details
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Monthly Strata Fee">
              <div className="rounded-sm border border-border bg-background px-2 py-1.5 text-sm font-mono">
                {money(loan.monthlyCondoFees)}
              </div>
            </Field>
            <Field label="Depreciation Report">
              <select
                className={selectCls}
                value={p.depreciationStatus}
                onChange={(e) => p.patch({ depreciationStatus: e.target.value as DepreciationStatus })}
              >
                <option value="">—</option>
                <option>Current</option>
                <option>Overdue</option>
                <option>Not Required</option>
              </select>
            </Field>
            <Field label="Building Age (yrs)">
              <input
                type="number"
                className={inputCls}
                value={p.buildingAgeYears ?? ""}
                onChange={(e) => p.patch({ buildingAgeYears: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Building # of Units">
              <input
                type="number"
                className={inputCls}
                value={p.buildingUnits ?? ""}
                onChange={(e) => p.patch({ buildingUnits: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={p.specialLevyOutstanding}
              onChange={(e) => p.patch({ specialLevyOutstanding: e.target.checked })}
            />
            Special levy outstanding
          </label>
        </div>
      )}

      {/* Leasehold */}
      {isLeasehold && (
        <div className="mt-4 rounded-sm border border-warning/40 bg-warning-bg/40 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-warning-fg">
            Leasehold Details — most A lenders decline
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Lease Expiry Year">
              <input
                type="number"
                className={inputCls}
                value={p.leaseExpiryYear ?? ""}
                onChange={(e) => p.patch({ leaseExpiryYear: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="Leaseholder (Municipality / First Nation)">
              <input className={inputCls} value={p.leaseholder} onChange={(e) => p.patch({ leaseholder: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {/* Rural */}
      {isRural && (
        <div className="mt-4 rounded-sm border border-border/60 bg-muted/20 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Rural Property Flags
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={p.wellWater} onChange={(e) => p.patch({ wellWater: e.target.checked })} />
              Well water
            </label>
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={p.septicSystem} onChange={(e) => p.patch({ septicSystem: e.target.checked })} />
              Septic system
            </label>
            <Field label="Acreage">
              <input
                type="number"
                className={inputCls}
                value={p.acreage ?? ""}
                onChange={(e) => p.patch({ acreage: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>
        </div>
      )}

      {/* Multi-unit / mixed use */}
      {isMultiUnit && (
        <div className="mt-4 rounded-sm border border-border/60 bg-muted/20 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Multi-unit / Mixed-Use
          </div>
          <Field label="Commercial portion of property (%)">
            <input
              type="number"
              className={inputCls}
              value={p.commercialPortionPct ?? ""}
              onChange={(e) =>
                p.patch({ commercialPortionPct: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
        </div>
      )}

      {/* Appraisal */}
      <div className="mt-4 rounded-sm border border-border/60 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Appraisal
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Status">
            <select
              className={selectCls}
              value={p.appraisalStatus}
              onChange={(e) => p.patch({ appraisalStatus: e.target.value as AppraisalStatus })}
            >
              <option>Not ordered</option>
              <option>Ordered</option>
              <option>Received</option>
            </select>
          </Field>
          <Field label="Appraised Value">
            <input
              type="number"
              className={inputCls}
              value={p.appraisedValue ?? ""}
              onChange={(e) => p.patch({ appraisedValue: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Appraiser Name">
            <input className={inputCls} value={p.appraiserName} onChange={(e) => p.patch({ appraiserName: e.target.value })} />
          </Field>
          <Field label="Firm">
            <input className={inputCls} value={p.appraiserFirm} onChange={(e) => p.patch({ appraiserFirm: e.target.value })} />
          </Field>
        </div>
        {appraisalLow && (
          <div className="mt-3 flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>CRITICAL:</strong> Appraised value {money(p.appraisedValue ?? 0)} is below purchase
              price {money(loan.propertyPrice)}. LTV must be recalculated on the lower value.
            </span>
          </div>
        )}
      </div>

      {/* Lender Eligibility Summary */}
      <div className="mt-4 rounded-sm border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Lender Eligibility Summary
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${streamColor[eligibility.prime]}`}>
            {streamIcon(eligibility.prime)} Prime · {eligibility.prime}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${streamColor[eligibility.alt]}`}>
            {streamIcon(eligibility.alt)} Alt / B · {eligibility.alt}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${streamColor[eligibility.private]}`}>
            {streamIcon(eligibility.private)} Private / MIC · {eligibility.private}
          </span>
        </div>
        {eligibility.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {eligibility.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground/60">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
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

function Flag({ tone, children }: { tone: "warn" | "critical"; children: React.ReactNode }) {
  const cls =
    tone === "critical"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-warning/40 bg-warning-bg text-warning-fg";
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-semibold uppercase tracking-wider ${cls}`}>
      <AlertTriangle className="h-3 w-3" />
      {children}
    </span>
  );
}
