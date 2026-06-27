/**
 * Global Application Store — Source of Truth for all financial inputs.
 *
 * Every input field in the UI is wired directly to this store. Derived
 * financial math (LTV, GDS, TDS, monthly P+I, household income, REO rental
 * contribution) is exposed via memoized selectors so any change instantly
 * recalculates ratios across the entire app.
 *
 * RULE: Do not use local useState for financial math. Read inputs and
 * derived values from this store.
 */
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useMemo } from "react";
import {
  calculateDebtService,
  type DebtServiceResult,
  type LiabilityInputs,
} from "@/utils/debtService";

// ─── REO property shape ─────────────────────────────────────────────────────
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

const uid = () => Math.random().toString(36).slice(2, 10);

// ─── Loan / household inputs ────────────────────────────────────────────────
export interface LoanInputs {
  propertyPrice: number;
  downPayment: number;
  interestRatePct: number;
  amortizationYears: number;
  termMonths: number;
  roePct: number;
  primaryAnnualIncome: number;
  primaryOtherMonthlyDebt: number;
  coApplicantEnabled: boolean;
  coAnnualIncome: number;
  coOtherMonthlyDebt: number;
  annualPropertyTaxes: number;
  monthlyHeating: number;
  monthlyCondoFees: number;
}

export const DEFAULT_LOAN_INPUTS: LoanInputs = {
  propertyPrice: 0,
  downPayment: 0,
  interestRatePct: 0,
  amortizationYears: 25,
  termMonths: 60,
  roePct: 0,
  primaryAnnualIncome: 0,
  primaryOtherMonthlyDebt: 0,
  coApplicantEnabled: false,
  coAnnualIncome: 0,
  coOtherMonthlyDebt: 0,
  annualPropertyTaxes: 0,
  monthlyHeating: 0,
  monthlyCondoFees: 0,
};

const DEFAULT_REO: ReoProperty[] = [];


// ─── Store shape ────────────────────────────────────────────────────────────
interface ApplicationState {
  loan: LoanInputs;
  reo: ReoProperty[];
  lenderStream: LenderStream;

  setLoanField: <K extends keyof LoanInputs>(key: K, value: LoanInputs[K]) => void;
  patchLoan: (patch: Partial<LoanInputs>) => void;
  resetLoan: () => void;

  addReo: () => void;
  updateReo: (id: string, patch: Partial<ReoProperty>) => void;
  removeReo: (id: string) => void;
  setLenderStream: (s: LenderStream) => void;
}

export const useApplicationStore = create<ApplicationState>((set) => ({
  loan: DEFAULT_LOAN_INPUTS,
  reo: DEFAULT_REO,
  lenderStream: "A",

  setLoanField: (key, value) =>
    set((s) => ({ loan: { ...s.loan, [key]: value } })),
  patchLoan: (patch) => set((s) => ({ loan: { ...s.loan, ...patch } })),
  resetLoan: () => set({ loan: DEFAULT_LOAN_INPUTS }),

  addReo: () =>
    set((s) => ({
      reo: [
        ...s.reo,
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
      ],
    })),
  updateReo: (id, patch) =>
    set((s) => ({
      reo: s.reo.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removeReo: (id) => set((s) => ({ reo: s.reo.filter((p) => p.id !== id) })),
  setLenderStream: (s) => set({ lenderStream: s }),
}));

// ─── Derived math (pure) ────────────────────────────────────────────────────
/** Canadian semi-annual compounded monthly mortgage payment. */
function monthlyPaymentCAD(principal: number, annualRatePct: number, amortYears: number) {
  if (principal <= 0 || amortYears <= 0) return 0;
  const r = annualRatePct / 100;
  const monthlyRate = Math.pow(1 + r / 2, 2 / 12) - 1;
  const n = amortYears * 12;
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

export interface ReoTotals {
  value: number;
  debt: number;
  gross: number;
  pith: number;
  addBack: number;
  offset: number;
  ltv: number;
}

export function computeReoTotals(rows: ReoProperty[]): ReoTotals {
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
    addBack += annualRent * 0.5;
    const annualPI = p.freeAndClear ? 0 : p.mortgageBalance * 0.06;
    offset += annualRent - monthlyPith * 12 - annualPI;
  }
  const ltv = value > 0 ? (debt / value) * 100 : 0;
  return { value, debt, gross, pith, addBack, offset, ltv };
}

export interface DerivedFinancials {
  loanAmount: number;
  ltv: number;
  monthlyPI: number;
  householdIncome: number;
  liabilities: LiabilityInputs;
  ds: DebtServiceResult;
  reoTotals: ReoTotals;
  rentalContribution: number;
}

export function deriveFinancials(
  loan: LoanInputs,
  reo: ReoProperty[],
  lenderStream: LenderStream,
): DerivedFinancials {
  const price = Math.max(0, loan.propertyPrice);
  const dp = Math.max(0, loan.downPayment);
  const loanAmount = Math.max(0, price - dp);
  const ltv = price > 0 ? (loanAmount / price) * 100 : 0;
  const monthlyPI = monthlyPaymentCAD(loanAmount, loan.interestRatePct, loan.amortizationYears);

  const reoTotals = computeReoTotals(reo);
  const rentalContribution = lenderStream === "A" ? reoTotals.addBack : reoTotals.offset;

  const householdIncome =
    loan.primaryAnnualIncome +
    (loan.coApplicantEnabled ? loan.coAnnualIncome : 0) +
    Math.max(0, rentalContribution);

  const liabilities: LiabilityInputs = {
    monthlyMortgagePI: monthlyPI,
    annualPropertyTaxes: loan.annualPropertyTaxes,
    monthlyHeating: loan.monthlyHeating,
    monthlyCondoFees: loan.monthlyCondoFees,
    otherMonthlyDebt:
      loan.primaryOtherMonthlyDebt +
      (loan.coApplicantEnabled ? loan.coOtherMonthlyDebt : 0),
  };
  const ds = calculateDebtService(householdIncome, liabilities);

  return { loanAmount, ltv, monthlyPI, householdIncome, liabilities, ds, reoTotals, rentalContribution };
}

// ─── Hooks ──────────────────────────────────────────────────────────────────
/** Subscribe to raw loan inputs (shallow-compared). */
export function useLoanInputs() {
  return useApplicationStore(useShallow((s) => s.loan));
}

/**
 * Memoized derived financial layer. Recomputes only when loan, reo, or
 * lenderStream change. Provides LTV / GDS / TDS / monthly P+I globally.
 */
export function useDerivedFinancials(): DerivedFinancials {
  const loan = useApplicationStore((s) => s.loan);
  const reo = useApplicationStore((s) => s.reo);
  const lenderStream = useApplicationStore((s) => s.lenderStream);
  return useMemo(() => deriveFinancials(loan, reo, lenderStream), [loan, reo, lenderStream]);
}
