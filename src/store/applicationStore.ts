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
import {
  computeCmhc,
  computeRentalOffset,
  monthlyPaymentCAD,
  qualifyingRate,
  thresholdsForStream,
  minQualifyingIncome,
  type CmhcResult,
  type PropertyRole,
  type RentalOffsetRule,
  type PropertyType,
  type UnderwritingStream,
} from "@/utils/underwritingEngine";
import { useUnderwritingConfigStore } from "@/store/underwritingConfigStore";

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
  propertyRole: PropertyRole;
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
          propertyRole: "investment" as PropertyRole,
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

export interface StressTestResult {
  qualifyingRatePct: number;
  monthlyPI: number;
  gds: number;
  tds: number;
  gdsCap: number;
  tdsCap: number;
  pass: boolean;
  minQualifyingIncome: number;
  requiresStressTest: boolean;
  stream: UnderwritingStream;
}

export interface UnderwritingConfigInputs {
  stream: UnderwritingStream;
  propertyType: PropertyType;
  rentalOffsetRule: RentalOffsetRule;
  vacancyFactor: boolean;
  scenarioEnabled: boolean;
  scenarioLoanAmountOverride: number | null;
  scenarioAmortOverride: number | null;
  scenarioIncomeOverride: number | null;
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
  cmhc: CmhcResult;
  stress: StressTestResult;
}

export function deriveFinancials(
  loan: LoanInputs,
  reo: ReoProperty[],
  config: UnderwritingConfigInputs,
): DerivedFinancials {
  const price = Math.max(0, loan.propertyPrice);
  const dp = Math.max(0, loan.downPayment);
  const baseLoan = Math.max(0, price - dp);

  // What-if scenario override
  const effectiveLoan =
    config.scenarioEnabled && config.scenarioLoanAmountOverride != null
      ? Math.max(0, config.scenarioLoanAmountOverride)
      : baseLoan;
  const effectiveAmort =
    config.scenarioEnabled && config.scenarioAmortOverride != null
      ? Math.max(1, config.scenarioAmortOverride)
      : loan.amortizationYears;

  const ltv = price > 0 ? (effectiveLoan / price) * 100 : 0;

  // CMHC premium on top of loan when LTV > 80 and eligible
  const cmhc = computeCmhc(effectiveLoan, price, config.propertyType);
  const financedAmount = cmhc.eligible ? cmhc.insuredMortgage : effectiveLoan;

  const monthlyPI = monthlyPaymentCAD(financedAmount, loan.interestRatePct, effectiveAmort);

  // Rental offset via config rule
  const reoInputs = reo.map((p) => {
    const monthlyPith = (p.propertyTax + p.insurance + p.heating) / 12;
    const monthlyPI = p.freeAndClear ? 0 : (p.mortgageBalance * 0.06) / 12;
    return { monthlyRent: p.monthlyRent, monthlyPith, monthlyPI, role: p.propertyRole };
  });
  const rentalOffset = computeRentalOffset(reoInputs, config.rentalOffsetRule, config.vacancyFactor);
  const reoTotals = computeReoTotals(reo);
  const rentalContribution = rentalOffset.incomeAddAnnual;

  const baseIncome =
    (config.scenarioEnabled && config.scenarioIncomeOverride != null
      ? Math.max(0, config.scenarioIncomeOverride)
      : loan.primaryAnnualIncome + (loan.coApplicantEnabled ? loan.coAnnualIncome : 0)) +
    Math.max(0, rentalContribution);
  const householdIncome = baseIncome;

  const otherMonthlyDebt =
    loan.primaryOtherMonthlyDebt +
    (loan.coApplicantEnabled ? loan.coOtherMonthlyDebt : 0) +
    rentalOffset.debtAddAnnual / 12;

  const liabilities: LiabilityInputs = {
    monthlyMortgagePI: monthlyPI,
    annualPropertyTaxes: loan.annualPropertyTaxes,
    monthlyHeating: loan.monthlyHeating,
    monthlyCondoFees: loan.monthlyCondoFees,
    otherMonthlyDebt,
  };
  const ds = calculateDebtService(householdIncome, liabilities);

  // Stress test — recompute PI at qualifying rate
  const qRate = qualifyingRate(loan.interestRatePct);
  const stressedPI = monthlyPaymentCAD(financedAmount, qRate, effectiveAmort);
  const stressedLiab: LiabilityInputs = { ...liabilities, monthlyMortgagePI: stressedPI };
  const stressedDS = calculateDebtService(householdIncome, stressedLiab);
  const thresholds = thresholdsForStream(config.stream);

  const stress: StressTestResult = {
    qualifyingRatePct: qRate,
    monthlyPI: stressedPI,
    gds: stressedDS.gds,
    tds: stressedDS.tds,
    gdsCap: thresholds.gdsCap,
    tdsCap: thresholds.tdsCap,
    pass:
      !thresholds.requiresStressTest ||
      (stressedDS.gds <= thresholds.gdsCap && stressedDS.tds <= thresholds.tdsCap),
    minQualifyingIncome: minQualifyingIncome(
      stressedPI,
      liabilities.annualPropertyTaxes / 12,
      liabilities.monthlyHeating,
      liabilities.monthlyCondoFees * 0.5,
      liabilities.otherMonthlyDebt,
      thresholds,
    ),
    requiresStressTest: thresholds.requiresStressTest,
    stream: config.stream,
  };

  return {
    loanAmount: financedAmount,
    ltv,
    monthlyPI,
    householdIncome,
    liabilities,
    ds,
    reoTotals,
    rentalContribution,
    cmhc,
    stress,
  };
}

// ─── Hooks ──────────────────────────────────────────────────────────────────
/** Subscribe to raw loan inputs (shallow-compared). */
export function useLoanInputs() {
  return useApplicationStore(useShallow((s) => s.loan));
}

/**
 * Memoized derived financial layer. Recomputes when loan, reo, or any
 * underwriting-config knob changes.
 */
export function useDerivedFinancials(): DerivedFinancials {
  const loan = useApplicationStore((s) => s.loan);
  const reo = useApplicationStore((s) => s.reo);
  const cfg = useUnderwritingConfigStore();
  return useMemo(
    () =>
      deriveFinancials(loan, reo, {
        stream: cfg.stream,
        propertyType: cfg.propertyType,
        rentalOffsetRule: cfg.rentalOffsetRule,
        vacancyFactor: cfg.vacancyFactor,
        scenarioEnabled: cfg.scenarioEnabled,
        scenarioLoanAmountOverride: cfg.scenarioLoanAmountOverride,
        scenarioAmortOverride: cfg.scenarioAmortOverride,
        scenarioIncomeOverride: cfg.scenarioIncomeOverride,
      }),
    [
      loan,
      reo,
      cfg.stream,
      cfg.propertyType,
      cfg.rentalOffsetRule,
      cfg.vacancyFactor,
      cfg.scenarioEnabled,
      cfg.scenarioLoanAmountOverride,
      cfg.scenarioAmortOverride,
      cfg.scenarioIncomeOverride,
    ],
  );
}

