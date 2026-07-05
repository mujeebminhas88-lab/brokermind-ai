/**
 * Co-Applicant Full Module (NEW-H).
 * Extends the primitive coApplicantEnabled/coAnnualIncome fields on
 * applicationStore with full personal, employment, credit, and role data.
 */
import { create } from "zustand";

export type Relationship = "Spouse" | "Common-law" | "Parent" | "Child" | "Sibling" | "Other";
export type CoRole = "Co-borrower" | "Guarantor";
export type CoEmploymentType = "Salaried" | "Self-Employed" | "Incorporated";

export interface CoApplicantState {
  fullName: string;
  dateOfBirth: string;               // yyyy-mm-dd
  relationship: Relationship;
  role: CoRole;

  employmentType: CoEmploymentType;
  employer: string;
  yearsAtEmployer: number;

  // Income (mirror primary)
  t4Income: number;
  t1LineTotalIncome: number;
  selfEmploymentNet: number;
  t2AddBack: number;

  // Credit
  beacon: number | null;
  activeTrades: number;
  revolvingUtilisationPct: number;
  hasCollections: boolean;
  hasBankruptcy: boolean;
  hasConsumerProposal: boolean;

  // Liabilities (monthly)
  studentLoansMonthly: number;
  autoLoanMonthly: number;
  otherCreditMonthly: number;

  patch: (p: Partial<CoApplicantState>) => void;
  reset: () => void;
}

const INITIAL: Omit<CoApplicantState, "patch" | "reset"> = {
  fullName: "",
  dateOfBirth: "",
  relationship: "Spouse",
  role: "Co-borrower",
  employmentType: "Salaried",
  employer: "",
  yearsAtEmployer: 0,
  t4Income: 0,
  t1LineTotalIncome: 0,
  selfEmploymentNet: 0,
  t2AddBack: 0,
  beacon: null,
  activeTrades: 0,
  revolvingUtilisationPct: 0,
  hasCollections: false,
  hasBankruptcy: false,
  hasConsumerProposal: false,
  studentLoansMonthly: 0,
  autoLoanMonthly: 0,
  otherCreditMonthly: 0,
};

export const useCoApplicantStore = create<CoApplicantState>((set) => ({
  ...INITIAL,
  patch: (p) => set((s) => ({ ...s, ...p })),
  reset: () => set({ ...INITIAL }),
}));

export function coApplicantQualifyingIncome(s: CoApplicantState): number {
  const base =
    s.employmentType === "Salaried"
      ? s.t4Income
      : s.employmentType === "Self-Employed"
        ? Math.max(s.selfEmploymentNet, s.t1LineTotalIncome)
        : s.t4Income + s.t2AddBack;
  return Math.max(0, base);
}

export function coApplicantMonthlyDebt(s: CoApplicantState): number {
  return s.studentLoansMonthly + s.autoLoanMonthly + s.otherCreditMonthly;
}
