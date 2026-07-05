/**
 * Source of Down Payment store — FINTRAC-compliant tracking of the
 * origin of funds. Alerts feed useComplianceAlerts + the dossier gate.
 */
import { create } from "zustand";

export type FundsSource =
  | ""
  | "Personal Savings"
  | "Gift from Family"
  | "RRSP Home Buyers Plan"
  | "Sale of Property"
  | "Borrowed Funds"
  | "Other";

export interface FundsState {
  source: FundsSource;
  amount: number;
  documentUploaded: boolean;
  otherDescription: string;

  // Gift-specific
  donorName: string;
  donorRelationship: string;
  giftAmount: number;
  propertyAddress: string;

  // RRSP HBP
  hbpPrimary: number;
  hbpCoApplicant: number;
  hbpRepaymentActive: boolean;

  patch: (p: Partial<FundsState>) => void;
  reset: () => void;
}

const DEFAULT: Omit<FundsState, "patch" | "reset"> = {
  source: "",
  amount: 0,
  documentUploaded: false,
  otherDescription: "",
  donorName: "",
  donorRelationship: "",
  giftAmount: 0,
  propertyAddress: "",
  hbpPrimary: 0,
  hbpCoApplicant: 0,
  hbpRepaymentActive: false,
};

export const useFundsStore = create<FundsState>((set) => ({
  ...DEFAULT,
  patch: (p) => set((s) => ({ ...s, ...p })),
  reset: () => set(DEFAULT),
}));

export interface FundsAlert {
  code: string;
  label: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "WARN";
  jumpTo: string;
}

export function computeFundsAlerts(
  s: FundsState,
  ltvPct: number,
): FundsAlert[] {
  const out: FundsAlert[] = [];
  if (!s.source) {
    out.push({
      code: "FUNDS-SOURCE-MISSING",
      label: "Source of down payment not documented",
      detail: "FINTRAC requires a documented source of funds for every mortgage transaction.",
      severity: "CRITICAL",
      jumpTo: "funds-panel",
    });
    return out;
  }
  if (!s.documentUploaded) {
    out.push({
      code: "FUNDS-DOC-MISSING",
      label: `Supporting document missing (${s.source})`,
      detail: "Upload the required supporting documentation for this source of funds.",
      severity: "CRITICAL",
      jumpTo: "funds-panel",
    });
  }
  if (s.source === "Borrowed Funds") {
    const insured = ltvPct > 80;
    out.push({
      code: "FUNDS-BORROWED",
      label: insured
        ? "Borrowed down payment — restricted on insured mortgage"
        : "Borrowed down payment — lender warning",
      detail: insured
        ? "Borrowed funds are not permitted as down payment on insured mortgages (LTV > 80%)."
        : "Borrowed funds may be permitted on conventional mortgages; document terms and repayment.",
      severity: insured ? "CRITICAL" : "HIGH",
      jumpTo: "funds-panel",
    });
  }
  if (s.source === "Other" && !s.otherDescription.trim()) {
    out.push({
      code: "FUNDS-OTHER-VAGUE",
      label: "Source of funds unclear",
      detail: "Describe the source. Undocumented sources are treated as a FINTRAC red flag.",
      severity: "CRITICAL",
      jumpTo: "funds-panel",
    });
  }
  return out;
}

/** RRSP HBP eligibility ceilings and annual repayment (÷15). */
export function computeHbp(s: FundsState) {
  const primary = Math.min(35000, Math.max(0, s.hbpPrimary));
  const co = Math.min(35000, Math.max(0, s.hbpCoApplicant));
  const total = Math.min(70000, primary + co);
  const annualRepayment = total / 15;
  return { primary, co, total, annualRepayment };
}

export function buildGiftLetter(s: FundsState): string {
  const today = new Date().toLocaleDateString("en-CA");
  return `GIFT LETTER

Date: ${today}

I/We, ${s.donorName || "[Donor Name]"}, being the ${s.donorRelationship || "[Relationship]"} of the applicant, hereby confirm that I/we have made a bona fide gift of $${s.giftAmount.toLocaleString("en-CA")} CAD to the applicant toward the purchase of the property located at:

${s.propertyAddress || "[Property Address]"}

I/We further confirm that:
  1. This gift is non-repayable and no repayment is expected or required.
  2. The funds are given from my/our own resources and are not borrowed.
  3. No party to the transaction has provided or will provide these funds.

Donor Signature: __________________________     Date: __________
Donor Printed Name: ${s.donorName || "__________________________"}

Applicant Signature: ______________________     Date: __________
`;
}
