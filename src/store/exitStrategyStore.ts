/**
 * Exit Strategy store (NEW-J) — required for Private/MIC lending.
 * Route, target date, trigger event, holding costs.
 */
import { create } from "zustand";

export type ExitRoute = "Refinance to A Lender" | "Refinance to B Lender" | "Sale of Property" | "Other";

export interface ExitStrategyState {
  route: ExitRoute;
  targetDate: string;      // yyyy-mm-dd
  triggerEvent: string;
  privateRatePct: number;
  loanAmount: number;      // if 0, panel falls back to derived loan amount
  termMonths: number;
  lenderFeePct: number;
  brokerFeePct: number;
  estimatedAppreciationPct: number; // annual %

  patch: (p: Partial<ExitStrategyState>) => void;
  reset: () => void;
}

const INITIAL: Omit<ExitStrategyState, "patch" | "reset"> = {
  route: "Refinance to A Lender",
  targetDate: "",
  triggerEvent: "",
  privateRatePct: 10.99,
  loanAmount: 0,
  termMonths: 12,
  lenderFeePct: 2,
  brokerFeePct: 1,
  estimatedAppreciationPct: 3,
};

export const useExitStrategyStore = create<ExitStrategyState>((set) => ({
  ...INITIAL,
  patch: (p) => set((s) => ({ ...s, ...p })),
  reset: () => set({ ...INITIAL }),
}));

export function holdingInterest(loan: number, ratePct: number, months: number): number {
  return Math.max(0, loan) * (ratePct / 100) * (months / 12);
}

export function feesTotal(loan: number, lenderFeePct: number, brokerFeePct: number): number {
  return loan * ((lenderFeePct + brokerFeePct) / 100);
}

/** Estimate months until LTV crosses 80% based on appreciation only. */
export function monthsToLtv80(currentValue: number, currentDebt: number, appreciationPct: number): number | null {
  if (currentValue <= 0 || currentDebt <= 0 || appreciationPct <= 0) return null;
  const targetValue = currentDebt / 0.8;
  if (targetValue <= currentValue) return 0;
  const years = Math.log(targetValue / currentValue) / Math.log(1 + appreciationPct / 100);
  return years * 12;
}
