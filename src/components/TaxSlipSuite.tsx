import { useMemo, useState } from "react";
import {
  reconcileTaxSlips,
  type T1,
  type T2,
  type T2125,
  type T4,
  type T4A,
  type TaxSlip,
  type VarianceFlag,
  type VarianceSeverity,
} from "@/utils/taxSlipParser";


/**
 * Phase 4 — Tax Slip Suite UI
 *
 * Tabbed intake for T4 / T1 / T2125 / T4A with a live cross-document forensic
 * variance panel. Fully reactive: any field edit re-runs reconcileTaxSlips()
 * and surfaces flags + a penalty roll-up. `onPenaltyChange` lets the parent
 * dashboard feed the penalty back into the aggregate risk score.
 */

type DocTab = "T4" | "T1" | "T2125" | "T4A";

const DEFAULT_YEAR = new Date().getFullYear() - 1;

const initialT4: T4 = {
  docType: "T4",
  taxYear: DEFAULT_YEAR,
  employerName: "",
  box14EmploymentIncome: 0,
  box16CPP: 0,
  box18EI: 0,
  box22IncomeTaxDeducted: 0,
  box40OtherTaxableAllowances: 0,
};

const initialT1: T1 = {
  docType: "T1",
  taxYear: DEFAULT_YEAR,
  taxpayerName: "",
  line10100Employment: 0,
  line13500SelfEmployment: 0,
  line12600RentalNet: 0,
  line11500Pension: 0,
  line15000TotalIncome: 0,
  line23600NetIncome: 0,
  line26000TaxableIncome: 0,
  balanceOwing: 0,
};

const initialT2125: T2125 = {
  docType: "T2125",
  taxYear: DEFAULT_YEAR,
  businessName: "",
  grossBusinessIncome: 0,
  totalBusinessExpenses: 0,
  netBusinessIncome: 0,
};

const initialT4A: T4A = {
  docType: "T4A",
  taxYear: DEFAULT_YEAR,
  payerName: "",
  box016Pension: 0,
  box020SelfEmpCommissions: 0,
  box048FeesForServices: 0,
  box105Scholarships: 0,
};

const severityClass: Record<VarianceSeverity, string> = {
  INFO: "border-border bg-muted text-muted-foreground",
  MINOR: "border-warning/40 bg-warning-bg text-warning-fg",
  MATERIAL: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  CRITICAL: "border-destructive/40 bg-destructive/10 text-destructive",
};

interface Props {
  onPenaltyChange?: (penalty: number, flags: VarianceFlag[]) => void;
}

export function TaxSlipSuite({ onPenaltyChange }: Props) {
  const [tab, setTab] = useState<DocTab>("T1");
  const [t1, setT1] = useState<T1>(initialT1);
  const [t4s, setT4s] = useState<T4[]>([initialT4]);
  const [t2125s, setT2125s] = useState<T2125[]>([initialT2125]);
  const [t4as, setT4as] = useState<T4A[]>([initialT4A]);

  const allSlips = useMemo<TaxSlip[]>(
    () => [t1, ...t4s, ...t2125s, ...t4as],
    [t1, t4s, t2125s, t4as],
  );

  const report = useMemo(() => reconcileTaxSlips(allSlips), [allSlips]);

  // Reactive feedback to parent (aggregate scoring matrix)
  useMemo(() => {
    onPenaltyChange?.(report.penaltyTotal, report.flags);
  }, [report.penaltyTotal, report.flags, onPenaltyChange]);

  return (
    <section className="rounded-sm border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Tax Slip Suite — Forensic Variance Engine
          </h2>
          <p className="text-xs text-muted-foreground">
            T4 · T1 · T2125 · T4A · cross-document reconciliation
          </p>
        </div>
        <ReportSummary report={report} />
      </header>

      <div className="flex gap-px border-b border-border bg-border">
        {(["T1", "T4", "T2125", "T4A"] as DocTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${
              tab === t
                ? "bg-card text-foreground"
                : "bg-muted text-muted-foreground hover:bg-card/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "T1" && <T1Form value={t1} onChange={setT1} />}
        {tab === "T4" && (
          <SlipList
            items={t4s}
            onChange={setT4s}
            label="T4 Statement"
            blank={initialT4}
            render={(item, update) => <T4Form value={item} onChange={update} />}
          />
        )}
        {tab === "T2125" && (
          <SlipList
            items={t2125s}
            onChange={setT2125s}
            label="T2125 Activity"
            blank={initialT2125}
            render={(item, update) => <T2125Form value={item} onChange={update} />}
          />
        )}
        {tab === "T4A" && (
          <SlipList
            items={t4as}
            onChange={setT4as}
            label="T4A Slip"
            blank={initialT4A}
            render={(item, update) => <T4AForm value={item} onChange={update} />}
          />
        )}
      </div>

      <FlagsPanel report={report} />
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Summary + flags
// ────────────────────────────────────────────────────────────────────────────────

function ReportSummary({ report }: { report: ReturnType<typeof reconcileTaxSlips> }) {
  const sev: VarianceSeverity =
    report.flags.some((f) => f.severity === "CRITICAL")
      ? "CRITICAL"
      : report.flags.some((f) => f.severity === "MATERIAL")
        ? "MATERIAL"
        : report.flags.some((f) => f.severity === "MINOR")
          ? "MINOR"
          : "INFO";
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-muted-foreground">
        Variance{" "}
        <strong className="font-mono text-foreground">
          {(report.variancePct * 100).toFixed(1)}%
        </strong>
      </span>
      <span className="text-muted-foreground">
        Penalty{" "}
        <strong className="font-mono text-foreground">+{report.penaltyTotal}</strong>
      </span>
      <span
        className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-semibold uppercase tracking-wide ${severityClass[sev]}`}
      >
        {report.flags.length === 0 ? "CLEAN" : sev}
      </span>
    </div>
  );
}

function FlagsPanel({ report }: { report: ReturnType<typeof reconcileTaxSlips> }) {
  if (report.flags.length === 0) {
    return (
      <div className="border-t border-border bg-success/8 px-5 py-3 text-xs text-success">
        ✓ No forensic variance detected across submitted source documents.
      </div>
    );
  }
  return (
    <div className="border-t border-border bg-muted/40 px-5 py-4 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Cross-document flags ({report.flags.length})
      </div>
      <ul className="space-y-2">
        {report.flags.map((f) => (
          <li
            key={f.code}
            className={`flex items-start justify-between gap-3 rounded-sm border px-3 py-2 text-xs ${severityClass[f.severity]}`}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider">{f.code}</span>
                <span className="font-semibold">{f.label}</span>
              </div>
              <div className="text-muted-foreground">{f.detail}</div>
              <div className="text-[10px] text-muted-foreground">
                Affects: {f.affectedDocs.join(", ")}
              </div>
            </div>
            <span className="font-mono text-xs font-bold">+{f.penaltyPoints}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Generic multi-slip list
// ────────────────────────────────────────────────────────────────────────────────

function SlipList<T>({
  items,
  onChange,
  label,
  blank,
  render,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  label: string;
  blank: T;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-sm border border-border bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label} #{idx + 1}
            </div>
            {items.length > 1 && (
              <button
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          {render(item, (patch) =>
            onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it))),
          )}
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { ...blank }])}
        className="w-full rounded-sm border border-dashed border-input bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:border-primary hover:text-foreground"
      >
        + Add {label}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Forms
// ────────────────────────────────────────────────────────────────────────────────

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({
  label,
  value,
  onChange,
  type = "number",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}

const n = (v: string) => (v === "" ? 0 : Number(v) || 0);

function T1Form({ value, onChange }: { value: T1; onChange: (next: T1) => void }) {
  const upd = (patch: Partial<T1>) => onChange({ ...value, ...patch });
  return (
    <FieldGrid>
      <Field label="Taxpayer name" type="text" value={value.taxpayerName} onChange={(v) => upd({ taxpayerName: v })} />
      <Field label="Tax year" value={value.taxYear} onChange={(v) => upd({ taxYear: n(v) })} />
      <Field label="Line 10100 — Employment" value={value.line10100Employment} onChange={(v) => upd({ line10100Employment: n(v) })} />
      <Field label="Line 13500 — Self-employment" value={value.line13500SelfEmployment} onChange={(v) => upd({ line13500SelfEmployment: n(v) })} />
      <Field label="Line 12600 — Rental (net)" value={value.line12600RentalNet} onChange={(v) => upd({ line12600RentalNet: n(v) })} />
      <Field label="Line 11500 — Pension" value={value.line11500Pension} onChange={(v) => upd({ line11500Pension: n(v) })} />
      <Field label="Line 15000 — Total income" value={value.line15000TotalIncome} onChange={(v) => upd({ line15000TotalIncome: n(v) })} />
      <Field label="Line 23600 — Net income" value={value.line23600NetIncome} onChange={(v) => upd({ line23600NetIncome: n(v) })} />
      <Field label="Line 26000 — Taxable income" value={value.line26000TaxableIncome} onChange={(v) => upd({ line26000TaxableIncome: n(v) })} />
      <Field label="Balance owing" value={value.balanceOwing} onChange={(v) => upd({ balanceOwing: n(v) })} />
    </FieldGrid>
  );
}

function T4Form({ value, onChange }: { value: T4; onChange: (patch: Partial<T4>) => void }) {
  return (
    <FieldGrid>
      <Field label="Employer name" type="text" value={value.employerName} onChange={(v) => onChange({ employerName: v })} />
      <Field label="Tax year" value={value.taxYear} onChange={(v) => onChange({ taxYear: n(v) })} />
      <Field label="Box 14 — Employment income" value={value.box14EmploymentIncome} onChange={(v) => onChange({ box14EmploymentIncome: n(v) })} />
      <Field label="Box 40 — Other taxable allowances" value={value.box40OtherTaxableAllowances} onChange={(v) => onChange({ box40OtherTaxableAllowances: n(v) })} />
      <Field label="Box 16 — CPP" value={value.box16CPP} onChange={(v) => onChange({ box16CPP: n(v) })} />
      <Field label="Box 18 — EI" value={value.box18EI} onChange={(v) => onChange({ box18EI: n(v) })} />
      <Field label="Box 22 — Tax deducted" value={value.box22IncomeTaxDeducted} onChange={(v) => onChange({ box22IncomeTaxDeducted: n(v) })} />
    </FieldGrid>
  );
}

function T2125Form({ value, onChange }: { value: T2125; onChange: (patch: Partial<T2125>) => void }) {
  return (
    <FieldGrid>
      <Field label="Business name" type="text" value={value.businessName} onChange={(v) => onChange({ businessName: v })} />
      <Field label="Tax year" value={value.taxYear} onChange={(v) => onChange({ taxYear: n(v) })} />
      <Field label="Gross business income" value={value.grossBusinessIncome} onChange={(v) => onChange({ grossBusinessIncome: n(v) })} />
      <Field label="Total business expenses" value={value.totalBusinessExpenses} onChange={(v) => onChange({ totalBusinessExpenses: n(v) })} />
      <Field label="Net business income" value={value.netBusinessIncome} onChange={(v) => onChange({ netBusinessIncome: Number(v) || 0 })} />
    </FieldGrid>
  );
}

function T4AForm({ value, onChange }: { value: T4A; onChange: (patch: Partial<T4A>) => void }) {
  return (
    <FieldGrid>
      <Field label="Payer name" type="text" value={value.payerName} onChange={(v) => onChange({ payerName: v })} />
      <Field label="Tax year" value={value.taxYear} onChange={(v) => onChange({ taxYear: n(v) })} />
      <Field label="Box 016 — Pension" value={value.box016Pension} onChange={(v) => onChange({ box016Pension: n(v) })} />
      <Field label="Box 020 — Self-emp commissions" value={value.box020SelfEmpCommissions} onChange={(v) => onChange({ box020SelfEmpCommissions: n(v) })} />
      <Field label="Box 048 — Fees for services" value={value.box048FeesForServices} onChange={(v) => onChange({ box048FeesForServices: n(v) })} />
      <Field label="Box 105 — Scholarships" value={value.box105Scholarships} onChange={(v) => onChange({ box105Scholarships: n(v) })} />
    </FieldGrid>
  );
}
