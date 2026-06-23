import { useEffect, useState } from "react";
import { ChevronDown, BriefcaseBusiness, FileSignature, FileSpreadsheet } from "lucide-react";
import type { RiskFlag } from "@/utils/noaParser";

export type EmploymentStatus =
  | "Full-Time Permanent"
  | "Part-Time"
  | "Contract"
  | "Probationary";

export type PayFrequency = "Weekly" | "Bi-Weekly" | "Semi-Monthly" | "Monthly";

export type InvoiceStatus = "Net 30" | "Paid" | "Outstanding";

export interface JobLetterState {
  status: EmploymentStatus;
  baseRate: number;
  tenureMonths: number;
}

export interface PayStubState {
  ytdGross: number;
  frequency: PayFrequency;
  currentPeriodGross: number;
}

export interface InvoiceState {
  invoiceDate: string;
  invoiceAmount: number;
  paymentStatus: InvoiceStatus;
}

export interface EmploymentState {
  jobLetter: JobLetterState;
  payStub: PayStubState;
  invoice: InvoiceState;
}

export const DEFAULT_EMPLOYMENT: EmploymentState = {
  jobLetter: { status: "Full-Time Permanent", baseRate: 92000, tenureMonths: 48 },
  payStub: { ytdGross: 58400, frequency: "Bi-Weekly", currentPeriodGross: 3540.85 },
  invoice: { invoiceDate: new Date().toISOString().slice(0, 10), invoiceAmount: 8750, paymentStatus: "Net 30" },
};

type Tab = "job" | "stub" | "invoice";

export function EmploymentIntakePanel({
  state,
  setState,
  onFlagsChange,
}: {
  state: EmploymentState;
  setState: React.Dispatch<React.SetStateAction<EmploymentState>>;
  onFlagsChange?: (flags: RiskFlag[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("job");

  useEffect(() => {
    const flags: RiskFlag[] = [];
    const { status, tenureMonths } = state.jobLetter;
    if (status === "Probationary" || tenureMonths < 3) {
      flags.push({
        code: "CREDIT-STABILITY-PROBATION",
        title: "Sub-3-month tenure or probationary employment",
        detail:
          "Applicant has less than 3 months tenure or is on probation. Standard A-Lender exception or co-signor may be required.",
        penalty: 14,
        severity: "Elevated",
      });
    }
    onFlagsChange?.(flags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.jobLetter.status, state.jobLetter.tenureMonths]);

  return (
    <section className="border-b border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-2.5 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 items-center justify-center text-primary-foreground"
            style={{ background: "var(--emerald-deep)" }}
          >
            <BriefcaseBusiness className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                05
              </span>
              <h2 className="text-[13px] font-bold tracking-tight">
                Current Employment &amp; Pay Verification
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Job Letter · Pay Stub · Invoice intake (real-time stability flags)
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="flex items-center gap-1 border-b border-border bg-secondary/30 px-4">
            <TabBtn active={tab === "job"} onClick={() => setTab("job")} icon={<FileSignature className="h-3 w-3" />}>
              Job Letter
            </TabBtn>
            <TabBtn active={tab === "stub"} onClick={() => setTab("stub")} icon={<FileSpreadsheet className="h-3 w-3" />}>
              Pay Stub
            </TabBtn>
            <TabBtn active={tab === "invoice"} onClick={() => setTab("invoice")} icon={<FileSpreadsheet className="h-3 w-3" />}>
              Invoices
            </TabBtn>
          </div>

          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
            {tab === "job" && (
              <>
                <SelectField
                  label="Employment Status"
                  value={state.jobLetter.status}
                  options={["Full-Time Permanent", "Part-Time", "Contract", "Probationary"]}
                  onChange={(v) =>
                    setState((p) => ({ ...p, jobLetter: { ...p.jobLetter, status: v as EmploymentStatus } }))
                  }
                />
                <CurrencyField
                  label="Guaranteed Base Salary / Hourly"
                  value={state.jobLetter.baseRate}
                  onChange={(v) => setState((p) => ({ ...p, jobLetter: { ...p.jobLetter, baseRate: v } }))}
                />
                <NumberField
                  label="Length of Employment (months)"
                  value={state.jobLetter.tenureMonths}
                  suffix="mo"
                  onChange={(v) => setState((p) => ({ ...p, jobLetter: { ...p.jobLetter, tenureMonths: v } }))}
                />
              </>
            )}

            {tab === "stub" && (
              <>
                <CurrencyField
                  label="YTD Gross Earnings"
                  value={state.payStub.ytdGross}
                  onChange={(v) => setState((p) => ({ ...p, payStub: { ...p.payStub, ytdGross: v } }))}
                />
                <SelectField
                  label="Pay Period Frequency"
                  value={state.payStub.frequency}
                  options={["Weekly", "Bi-Weekly", "Semi-Monthly", "Monthly"]}
                  onChange={(v) =>
                    setState((p) => ({ ...p, payStub: { ...p.payStub, frequency: v as PayFrequency } }))
                  }
                />
                <CurrencyField
                  label="Current Period Gross Pay"
                  value={state.payStub.currentPeriodGross}
                  onChange={(v) =>
                    setState((p) => ({ ...p, payStub: { ...p.payStub, currentPeriodGross: v } }))
                  }
                />
              </>
            )}

            {tab === "invoice" && (
              <>
                <DateField
                  label="Invoice Date"
                  value={state.invoice.invoiceDate}
                  onChange={(v) => setState((p) => ({ ...p, invoice: { ...p.invoice, invoiceDate: v } }))}
                />
                <CurrencyField
                  label="Gross Invoice Amount"
                  value={state.invoice.invoiceAmount}
                  onChange={(v) =>
                    setState((p) => ({ ...p, invoice: { ...p.invoice, invoiceAmount: v } }))
                  }
                />
                <SelectField
                  label="Payment Terms / Status"
                  value={state.invoice.paymentStatus}
                  options={["Net 30", "Paid", "Outstanding"]}
                  onChange={(v) =>
                    setState((p) => ({ ...p, invoice: { ...p.invoice, paymentStatus: v as InvoiceStatus } }))
                  }
                />
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors ${
        active
          ? "text-foreground border-b-2 -mb-px"
          : "text-muted-foreground hover:text-foreground"
      }`}
      style={active ? { borderColor: "var(--emerald)" } : undefined}
    >
      {icon}
      {children}
    </button>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex cursor-text flex-col bg-card px-3 py-2.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-[12px] text-muted-foreground">$</span>
        <input
          type="number"
          step="0.01"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent font-mono text-[14px] font-bold tracking-tight outline-none"
        />
      </div>
    </label>
  );
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex cursor-text flex-col bg-card px-3 py-2.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1">
        <input
          type="number"
          min={0}
          step="1"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent font-mono text-[14px] font-bold tracking-tight outline-none"
        />
        {suffix && <span className="font-mono text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex cursor-text flex-col bg-card px-3 py-2.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent font-mono text-[13px] font-bold tracking-tight outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col bg-card px-3 py-2.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full cursor-pointer bg-transparent font-mono text-[13px] font-bold tracking-tight outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
