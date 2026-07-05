/**
 * Underwriting configuration store — knobs that affect stress test, CMHC,
 * and rental offset math. Feeds into deriveFinancials.
 */
import { create } from "zustand";
import type {
  UnderwritingStream,
  RentalOffsetRule,
  CmhcInsurer,
  PropertyType,
} from "@/utils/underwritingEngine";

export interface UnderwritingConfigState {
  stream: UnderwritingStream;
  propertyType: PropertyType;
  cmhcInsurer: CmhcInsurer;
  rentalOffsetRule: RentalOffsetRule;
  vacancyFactor: boolean;
  useLowerYearIncome: boolean;
  /** NEW-A — Self-employed 2-year income averaging on Line 15000. */
  useTwoYearAverage: boolean;
  /** NEW-D — Add corporate retained earnings + owner comp back to qualifying income (Incorporated). */
  t2AddBackEnabled: boolean;
  /** Portion (0-1) of T2 net income added back. */
  t2AddBackPct: number;
  /** "What if" scenario overrides applied on top of loan inputs. */
  scenarioEnabled: boolean;
  scenarioLoanAmountOverride: number | null;
  scenarioAmortOverride: number | null;
  scenarioIncomeOverride: number | null;

  patch: (p: Partial<UnderwritingConfigState>) => void;
  resetScenario: () => void;
}

export const useUnderwritingConfigStore = create<UnderwritingConfigState>((set) => ({
  stream: "Prime",
  propertyType: "owner-occupied",
  cmhcInsurer: "CMHC",
  rentalOffsetRule: "50-offset",
  vacancyFactor: false,
  useLowerYearIncome: false,
  useTwoYearAverage: false,
  t2AddBackEnabled: false,
  t2AddBackPct: 1.0,
  scenarioEnabled: false,
  scenarioLoanAmountOverride: null,
  scenarioAmortOverride: null,
  scenarioIncomeOverride: null,

  patch: (p) => set((s) => ({ ...s, ...p })),
  resetScenario: () =>
    set({
      scenarioEnabled: false,
      scenarioLoanAmountOverride: null,
      scenarioAmortOverride: null,
      scenarioIncomeOverride: null,
    }),
}));
