/**
 * Underwriting engine utilities — CMHC premium, MQR stress test,
 * rental income offset. Pure functions, unit-testable.
 */

// ─── Canadian mortgage math ─────────────────────────────────────────────────
export function monthlyPaymentCAD(
  principal: number,
  annualRatePct: number,
  amortYears: number,
): number {
  if (principal <= 0 || amortYears <= 0) return 0;
  const r = annualRatePct / 100;
  const monthlyRate = Math.pow(1 + r / 2, 2 / 12) - 1;
  const n = amortYears * 12;
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

// ─── CMHC Insurance Premium (2025 rates) ────────────────────────────────────
export type CmhcInsurer = "CMHC" | "Sagen" | "Canada Guaranty";
export type PropertyType = "owner-occupied" | "rental" | "second-home";

export interface CmhcResult {
  applicable: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
  ltvPct: number;
  premiumRatePct: number;
  premiumAmount: number;
  insuredMortgage: number;
}

export function computeCmhc(
  baseLoan: number,
  propertyPrice: number,
  propertyType: PropertyType,
): CmhcResult {
  const ltv = propertyPrice > 0 ? (baseLoan / propertyPrice) * 100 : 0;
  const applicable = ltv > 80;
  if (!applicable) {
    return {
      applicable: false,
      eligible: true,
      ineligibleReason: null,
      ltvPct: ltv,
      premiumRatePct: 0,
      premiumAmount: 0,
      insuredMortgage: baseLoan,
    };
  }
  if (ltv > 95) {
    return {
      applicable: true,
      eligible: false,
      ineligibleReason: `LTV ${ltv.toFixed(1)}% exceeds maximum insured LTV of 95%.`,
      ltvPct: ltv,
      premiumRatePct: 0,
      premiumAmount: 0,
      insuredMortgage: baseLoan,
    };
  }
  if (propertyType === "rental") {
    return {
      applicable: true,
      eligible: false,
      ineligibleReason: "Rental properties are not eligible for CMHC insurance.",
      ltvPct: ltv,
      premiumRatePct: 0,
      premiumAmount: 0,
      insuredMortgage: baseLoan,
    };
  }
  if (propertyType === "second-home") {
    return {
      applicable: true,
      eligible: false,
      ineligibleReason: "Second / non-owner-occupied properties are not eligible for CMHC insurance.",
      ltvPct: ltv,
      premiumRatePct: 0,
      premiumAmount: 0,
      insuredMortgage: baseLoan,
    };
  }

  let rate = 0;
  if (ltv <= 85) rate = 2.8;
  else if (ltv <= 90) rate = 3.1;
  else rate = 4.0;

  const premium = baseLoan * (rate / 100);
  return {
    applicable: true,
    eligible: true,
    ineligibleReason: null,
    ltvPct: ltv,
    premiumRatePct: rate,
    premiumAmount: premium,
    insuredMortgage: baseLoan + premium,
  };
}

// ─── MQR / Stress Test (OSFI B-20) ──────────────────────────────────────────
export type UnderwritingStream = "Prime" | "Alt" | "Private";

export interface StreamThresholds {
  gdsCap: number;
  tdsCap: number;
  requiresStressTest: boolean;
}

export function thresholdsForStream(stream: UnderwritingStream): StreamThresholds {
  switch (stream) {
    case "Prime":
      return { gdsCap: 39, tdsCap: 44, requiresStressTest: true };
    case "Alt":
      return { gdsCap: 40, tdsCap: 45, requiresStressTest: true };
    case "Private":
      return { gdsCap: 50, tdsCap: 55, requiresStressTest: false };
  }
}

export const MQR_FLOOR_PCT = 5.25;
export const MQR_SPREAD_PCT = 2.0;

export function qualifyingRate(contractRatePct: number): number {
  return Math.max(contractRatePct + MQR_SPREAD_PCT, MQR_FLOOR_PCT);
}

/**
 * Minimum annual income needed to pass BOTH GDS and TDS caps at the
 * qualifying rate for the given non-mortgage housing/other-debt load.
 */
export function minQualifyingIncome(
  stressedMonthlyPI: number,
  monthlyPropertyTaxes: number,
  monthlyHeating: number,
  monthlyCondoHalf: number,
  otherMonthlyDebt: number,
  thresholds: StreamThresholds,
): number {
  const gdsNumMonthly = stressedMonthlyPI + monthlyPropertyTaxes + monthlyHeating + monthlyCondoHalf;
  const tdsNumMonthly = gdsNumMonthly + otherMonthlyDebt;
  const minMonthlyIncomeGds = (gdsNumMonthly / thresholds.gdsCap) * 100;
  const minMonthlyIncomeTds = (tdsNumMonthly / thresholds.tdsCap) * 100;
  return Math.max(minMonthlyIncomeGds, minMonthlyIncomeTds) * 12;
}

// ─── Rental income offset ──────────────────────────────────────────────────
export type RentalOffsetRule = "50-offset" | "80-add" | "100-add";
export type PropertyRole = "subject" | "investment" | "principal-selling";

export interface RentalOffsetInput {
  monthlyRent: number;
  monthlyPith: number;
  monthlyPI: number;
  role: PropertyRole;
}

export interface RentalOffsetResult {
  /** Annual income to ADD to household income for qualifying. */
  incomeAddAnnual: number;
  /** Annual debts to ADD (used by 50% rule that adds property expenses). */
  debtAddAnnual: number;
}

export function computeRentalOffset(
  props: RentalOffsetInput[],
  rule: RentalOffsetRule,
  vacancyFactor: boolean,
): RentalOffsetResult {
  let incomeAdd = 0;
  let debtAdd = 0;
  const vacancyMult = vacancyFactor ? 0.95 : 1;
  for (const p of props) {
    // Subject property: purchaser must qualify for full PITH, no offset benefit.
    if (p.role === "subject" || p.role === "principal-selling") continue;
    const annualRent = p.monthlyRent * 12 * vacancyMult;
    const annualExpense = (p.monthlyPith + p.monthlyPI) * 12;
    switch (rule) {
      case "50-offset":
        incomeAdd += annualRent * 0.5;
        debtAdd += annualExpense * 0.5;
        break;
      case "80-add":
        incomeAdd += annualRent * 0.8;
        break;
      case "100-add":
        incomeAdd += annualRent;
        break;
    }
  }
  return { incomeAddAnnual: incomeAdd, debtAddAnnual: debtAdd };
}
