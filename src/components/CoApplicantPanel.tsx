/**
 * Co-Applicant Full Module — NEW-H
 * Personal, employment, income, credit, liabilities, and role fields.
 * Combined household-income breakdown feeds GDS/TDS via applicationStore.
 */
import { useEffect, useMemo } from "react";
import { Users, UserCheck } from "lucide-react";
import {
  useCoApplicantStore,
  coApplicantQualifyingIncome,
  coApplicantMonthlyDebt,
  type Relationship,
  type CoRole,
  type CoEmploymentType,
} from "@/store/coApplicantStore";
import { useApplicationStore } from "@/store/applicationStore";
import { beaconTier } from "@/store/creditProfileStore";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const selectCls = inputCls;
const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function CoApplicantPanel() {
  const co = useCoApplicantStore();
  const loan = useApplicationStore((s) => s.loan);
  const patchLoan = useApplicationStore((s) => s.patchLoan);
  const setLoanField = useApplicationStore((s) => s.setLoanField);

  const qIncome = useMemo(() => coApplicantQualifyingIncome(co), [co]);
  const monthlyDebt = useMemo(() => coApplicantMonthlyDebt(co), [co]);
  const tier = beaconTier(co.beacon);

  // Sync computed income/debt into applicationStore so GDS/TDS stay accurate.
  useEffect(() => {
    if (!loan.coApplicantEnabled) return;
    if (loan.coAnnualIncome !== qIncome) setLoanField("coAnnualIncome", qIncome);
    if (loan.coOtherMonthlyDebt !== monthlyDebt) setLoanField("coOtherMonthlyDebt", monthlyDebt);
  }, [qIncome, monthlyDebt, loan.coApplicantEnabled, loan.coAnnualIncome, loan.coOtherMonthlyDebt, setLoanField]);

  const combined = loan.primaryAnnualIncome + (loan.coApplicantEnabled ? qIncome : 0);
  const guarantorNote = co.role === "Guarantor";

  if (!loan.coApplicantEnabled) {
    return (
      <section id="co-applicant" className="scroll-mt-24 rounded-sm border border-dashed border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Co-Applicant</h2>
              <p className="text-xs text-muted-foreground">
                Enable to add second applicant / guarantor. Household income and liabilities will roll into GDS/TDS.
              </p>
            </div>
          </div>
          <button
            onClick={() => patchLoan({ coApplicantEnabled: true })}
            className="rounded-sm border border-primary bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
          >
            Enable Co-Applicant
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="co-applicant" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Co-Applicant Details
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Personal · Employment · Income · Credit · Liabilities
          </p>
        </div>
        <button
          onClick={() => {
            patchLoan({ coApplicantEnabled: false, coAnnualIncome: 0, coOtherMonthlyDebt: 0 });
            co.reset();
          }}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Remove
        </button>
      </header>

      {/* Personal */}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Field label="Full Name">
          <input className={inputCls} value={co.fullName} onChange={(e) => co.patch({ fullName: e.target.value })} />
        </Field>
        <Field label="Date of Birth">
          <input type="date" className={inputCls} value={co.dateOfBirth} onChange={(e) => co.patch({ dateOfBirth: e.target.value })} />
        </Field>
        <Field label="Relationship">
          <select className={selectCls} value={co.relationship} onChange={(e) => co.patch({ relationship: e.target.value as Relationship })}>
            <option>Spouse</option>
            <option>Common-law</option>
            <option>Parent</option>
            <option>Child</option>
            <option>Sibling</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Role">
          <select className={selectCls} value={co.role} onChange={(e) => co.patch({ role: e.target.value as CoRole })}>
            <option>Co-borrower</option>
            <option>Guarantor</option>
          </select>
        </Field>
      </div>
      {guarantorNote && (
        <div className="mt-2 rounded-sm border border-warning/40 bg-warning-bg/40 p-2 text-[11px] text-warning-fg">
          Guarantor: not on title. Some lenders count guarantor income at 0–50%; confirm with lender.
        </div>
      )}

      {/* Employment */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Employment Type">
          <select className={selectCls} value={co.employmentType} onChange={(e) => co.patch({ employmentType: e.target.value as CoEmploymentType })}>
            <option>Salaried</option>
            <option>Self-Employed</option>
            <option>Incorporated</option>
          </select>
        </Field>
        <Field label="Employer / Business">
          <input className={inputCls} value={co.employer} onChange={(e) => co.patch({ employer: e.target.value })} />
        </Field>
        <Field label="Years at Employer">
          <input type="number" step="0.1" className={inputCls} value={co.yearsAtEmployer} onChange={(e) => co.patch({ yearsAtEmployer: Number(e.target.value) })} />
        </Field>
      </div>

      {/* Income */}
      <div className="mt-4 rounded-sm border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Income (Annual)
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="T4 Income">
            <input type="number" className={inputCls} value={co.t4Income} onChange={(e) => co.patch({ t4Income: Number(e.target.value) })} />
          </Field>
          <Field label="T1 Line 15000">
            <input type="number" className={inputCls} value={co.t1LineTotalIncome} onChange={(e) => co.patch({ t1LineTotalIncome: Number(e.target.value) })} />
          </Field>
          <Field label="Self-Emp Net">
            <input type="number" className={inputCls} value={co.selfEmploymentNet} onChange={(e) => co.patch({ selfEmploymentNet: Number(e.target.value) })} />
          </Field>
          <Field label="T2 Add-Back">
            <input type="number" className={inputCls} value={co.t2AddBack} onChange={(e) => co.patch({ t2AddBack: Number(e.target.value) })} />
          </Field>
        </div>
      </div>

      {/* Credit */}
      <div className="mt-4 rounded-sm border border-border/60 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Credit Profile
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Beacon Score">
            <input
              type="number"
              className={inputCls}
              value={co.beacon ?? ""}
              onChange={(e) => co.patch({ beacon: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Active Trades">
            <input type="number" className={inputCls} value={co.activeTrades} onChange={(e) => co.patch({ activeTrades: Number(e.target.value) })} />
          </Field>
          <Field label="Revolving Utilisation %">
            <input type="number" className={inputCls} value={co.revolvingUtilisationPct} onChange={(e) => co.patch({ revolvingUtilisationPct: Number(e.target.value) })} />
          </Field>
          <div className={`flex items-center justify-center rounded-sm border ${tier.border} ${tier.bg} p-2`}>
            <span className={`text-xs font-bold uppercase ${tier.color}`}>{tier.label}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={co.hasCollections} onChange={(e) => co.patch({ hasCollections: e.target.checked })} /> Collections</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={co.hasBankruptcy} onChange={(e) => co.patch({ hasBankruptcy: e.target.checked })} /> Bankruptcy</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={co.hasConsumerProposal} onChange={(e) => co.patch({ hasConsumerProposal: e.target.checked })} /> Consumer Proposal</label>
        </div>
      </div>

      {/* Liabilities */}
      <div className="mt-4 rounded-sm border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Monthly Liabilities
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Student Loans">
            <input type="number" className={inputCls} value={co.studentLoansMonthly} onChange={(e) => co.patch({ studentLoansMonthly: Number(e.target.value) })} />
          </Field>
          <Field label="Auto Loan">
            <input type="number" className={inputCls} value={co.autoLoanMonthly} onChange={(e) => co.patch({ autoLoanMonthly: Number(e.target.value) })} />
          </Field>
          <Field label="Other Credit">
            <input type="number" className={inputCls} value={co.otherCreditMonthly} onChange={(e) => co.patch({ otherCreditMonthly: Number(e.target.value) })} />
          </Field>
        </div>
      </div>

      {/* Household roll-up */}
      <div className="mt-4 rounded-sm border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <UserCheck className="h-3.5 w-3.5" />
          Combined Household Income
        </div>
        <div className="font-mono text-sm text-foreground">
          Primary: <strong>{money(loan.primaryAnnualIncome)}</strong> +{" "}
          Co-applicant: <strong>{money(qIncome)}</strong> ={" "}
          <span className="text-primary">{money(combined)}</span>
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          Co-applicant monthly debt {money(monthlyDebt)} added to TDS.
        </div>
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
