import { useMemo } from "react";
import { useFundsStore, computeHbp, buildGiftLetter, type FundsSource } from "@/store/fundsStore";
import { useDerivedFinancials } from "@/store/applicationStore";
import { toast } from "sonner";
import { Download, FileText, AlertTriangle } from "lucide-react";

const DOC_REQUIREMENTS: Record<Exclude<FundsSource, "">, string> = {
  "Personal Savings": "90-day bank statement showing accumulation of funds.",
  "Gift from Family": "Signed gift letter + evidence of donor's ability to gift.",
  "RRSP Home Buyers Plan": "T1028 form + first-time buyer confirmation.",
  "Sale of Property": "Executed purchase agreement or MLS listing.",
  "Borrowed Funds": "Loan agreement + monthly repayment terms.",
  Other: "Describe source and provide supporting documentation.",
};

export function SourceOfFundsPanel() {
  const s = useFundsStore();
  const derived = useDerivedFinancials();
  const hbp = useMemo(() => computeHbp(s), [s]);

  const downloadGiftLetter = () => {
    const text = buildGiftLetter(s);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gift-letter-${(s.donorName || "donor").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Gift letter downloaded");
  };

  const borrowedInsured = s.source === "Borrowed Funds" && derived.ltv > 80;

  return (
    <section id="funds-panel" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="border-b border-border pb-3">
        <h2 className="font-display text-base font-bold tracking-tight text-foreground">
          Source of Down Payment
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          FINTRAC-mandated documentation of the origin of down payment funds.
        </p>
      </header>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Source">
          <select
            value={s.source}
            onChange={(e) => s.patch({ source: e.target.value as FundsSource })}
            className={selectCls}
          >
            <option value="">Select…</option>
            <option>Personal Savings</option>
            <option>Gift from Family</option>
            <option>RRSP Home Buyers Plan</option>
            <option>Sale of Property</option>
            <option>Borrowed Funds</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Amount (CAD)">
          <input
            type="number"
            value={s.amount || ""}
            onChange={(e) => s.patch({ amount: Number(e.target.value) || 0 })}
            className={selectCls}
          />
        </Field>
      </div>

      {s.source && (
        <div className="mt-4 rounded-sm border border-border bg-muted/30 p-3 text-xs text-foreground">
          <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
            Required documentation
          </div>
          {DOC_REQUIREMENTS[s.source]}
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.documentUploaded}
              onChange={(e) => s.patch({ documentUploaded: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            <span className={s.documentUploaded ? "text-success" : "text-muted-foreground"}>
              {s.documentUploaded ? "Document uploaded" : "Document not uploaded"}
            </span>
          </label>
        </div>
      )}

      {s.source === "Borrowed Funds" && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-sm border p-3 text-xs ${
            borrowedInsured
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-warning/40 bg-warning-bg text-warning-fg"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {borrowedInsured ? (
              <>
                <strong>Restricted:</strong> Borrowed funds are not permitted as down payment on
                insured mortgages (LTV {derived.ltv.toFixed(1)}% &gt; 80%).
              </>
            ) : (
              <>
                <strong>Warning:</strong> Borrowed funds may be permitted on conventional mortgages
                but require full disclosure of loan terms and monthly repayment.
              </>
            )}
          </div>
        </div>
      )}

      {s.source === "Other" && (
        <div className="mt-3">
          <Field label="Describe the source">
            <textarea
              rows={2}
              value={s.otherDescription}
              onChange={(e) => s.patch({ otherDescription: e.target.value })}
              className={`${selectCls} resize-none`}
            />
          </Field>
        </div>
      )}

      {s.source === "Gift from Family" && (
        <div className="mt-4 rounded-sm border border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Gift Letter Generator
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Donor Name">
              <input value={s.donorName} onChange={(e) => s.patch({ donorName: e.target.value })} className={selectCls} />
            </Field>
            <Field label="Relationship">
              <input value={s.donorRelationship} onChange={(e) => s.patch({ donorRelationship: e.target.value })} className={selectCls} />
            </Field>
            <Field label="Gift Amount (CAD)">
              <input
                type="number"
                value={s.giftAmount || ""}
                onChange={(e) => s.patch({ giftAmount: Number(e.target.value) || 0 })}
                className={selectCls}
              />
            </Field>
            <Field label="Property Address">
              <input value={s.propertyAddress} onChange={(e) => s.patch({ propertyAddress: e.target.value })} className={selectCls} />
            </Field>
          </div>
          <button
            type="button"
            onClick={downloadGiftLetter}
            className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-primary bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> Generate Gift Letter
          </button>
        </div>
      )}

      {s.source === "RRSP Home Buyers Plan" && (
        <div className="mt-4 rounded-sm border border-border p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            RRSP HBP Calculator · Max $35,000/person · $70,000 combined
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Primary Applicant Withdrawal">
              <input
                type="number"
                value={s.hbpPrimary || ""}
                onChange={(e) => s.patch({ hbpPrimary: Number(e.target.value) || 0 })}
                className={selectCls}
              />
            </Field>
            <Field label="Co-Applicant Withdrawal">
              <input
                type="number"
                value={s.hbpCoApplicant || ""}
                onChange={(e) => s.patch({ hbpCoApplicant: Number(e.target.value) || 0 })}
                className={selectCls}
              />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Stat label="Eligible Total" value={`$${hbp.total.toLocaleString("en-CA")}`} />
            <Stat label="Annual Repayment (÷15)" value={`$${hbp.annualRepayment.toFixed(2)}`} />
            <Stat label="TDS Impact" value={s.hbpRepaymentActive ? `+$${(hbp.annualRepayment / 12).toFixed(2)}/mo` : "Inactive"} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={s.hbpRepaymentActive}
              onChange={(e) => s.patch({ hbpRepaymentActive: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            HBP repayments currently active — apply to TDS
          </label>
        </div>
      )}
    </section>
  );
}

const selectCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-card px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}
