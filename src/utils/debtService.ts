/**
 * Canadian OSFI B-20 Gross & Total Debt Service Ratio engine.
 *
 * GDS = (Monthly P+I + (AnnualTax / 12) + MonthlyHeat + (MonthlyCondo * 0.50))
 *       / (AnnualIncome / 12)
 *
 * TDS = (GDS numerator + OtherMonthlyDebt) / (AnnualIncome / 12)
 */

export interface LiabilityInputs {
  /** Stress-tested monthly principal + interest payment on the subject mortgage. */
  monthlyMortgagePI: number;
  /** Total annual property taxes (CAD). */
  annualPropertyTaxes: number;
  /** Monthly heating cost (CAD). */
  monthlyHeating: number;
  /** Monthly condo / strata fees (only 50% counts toward debt service per CMHC). */
  monthlyCondoFees: number;
  /** Sum of all other monthly debt obligations (cars, cards, LOCs). */
  otherMonthlyDebt: number;
}

export interface DebtServiceResult {
  monthlyIncome: number;
  gdsNumerator: number;
  tdsNumerator: number;
  gds: number; // percentage e.g. 34.2
  tds: number; // percentage
  gdsCap: number;
  tdsCap: number;
  gdsExceeded: boolean;
  tdsExceeded: boolean;
}

export const GDS_CAP = 39.0;
export const TDS_CAP = 44.0;

export const DEFAULT_LIABILITIES: LiabilityInputs = {
  monthlyMortgagePI: 2231.18,
  annualPropertyTaxes: 4200,
  monthlyHeating: 115,
  monthlyCondoFees: 0,
  otherMonthlyDebt: 571.4,
};

export function calculateDebtService(
  annualIncome: number,
  liab: LiabilityInputs
): DebtServiceResult {
  const monthlyIncome = Math.max(0, annualIncome) / 12;
  const gdsNumerator =
    Math.max(0, liab.monthlyMortgagePI) +
    Math.max(0, liab.annualPropertyTaxes) / 12 +
    Math.max(0, liab.monthlyHeating) +
    Math.max(0, liab.monthlyCondoFees) * 0.5;
  const tdsNumerator = gdsNumerator + Math.max(0, liab.otherMonthlyDebt);

  const gds = monthlyIncome > 0 ? (gdsNumerator / monthlyIncome) * 100 : 0;
  const tds = monthlyIncome > 0 ? (tdsNumerator / monthlyIncome) * 100 : 0;

  return {
    monthlyIncome,
    gdsNumerator,
    tdsNumerator,
    gds: Number.isFinite(gds) ? gds : 0,
    tds: Number.isFinite(tds) ? tds : 0,
    gdsCap: GDS_CAP,
    tdsCap: TDS_CAP,
    gdsExceeded: gds > GDS_CAP,
    tdsExceeded: tds > TDS_CAP,
  };
}

export function fmtCAD(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
