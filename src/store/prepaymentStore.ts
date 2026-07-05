/**
 * Pre-Payment Privilege Tracker (NEW-G).
 * Product prepayment terms + indicative penalty math + comparison scenarios.
 */
import { create } from "zustand";

export type PenaltyMethod = "IRD" | "3-Month Interest";
export type RateKind = "Fixed" | "Variable";

export interface PrepaymentTerms {
  lumpSumPct: number;         // annual lump sum % of original
  paymentIncreasePct: number; // annual payment increase %
  doubleUp: boolean;
  portability: boolean;
  assumability: boolean;
}

export interface ProductOption {
  id: string;
  lenderName: string;
  ratePct: number;
  rateKind: RateKind;
  termMonths: number;
  penaltyMethod: PenaltyMethod;
  privileges: PrepaymentTerms;
  notes: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyPriv: PrepaymentTerms = {
  lumpSumPct: 15,
  paymentIncreasePct: 15,
  doubleUp: true,
  portability: true,
  assumability: false,
};

export interface PrepaymentState {
  primary: PrepaymentTerms;
  penaltyMethod: PenaltyMethod;
  rateKind: RateKind;
  comparisonRatePct: number; // posted rate used for indicative IRD
  products: ProductOption[];

  patchPrimary: (p: Partial<PrepaymentTerms>) => void;
  patch: (p: Partial<Omit<PrepaymentState, "products" | "primary" | "patchPrimary" | "patch" | "addProduct" | "updateProduct" | "removeProduct">>) => void;
  addProduct: () => void;
  updateProduct: (id: string, patch: Partial<ProductOption>) => void;
  removeProduct: (id: string) => void;
}

export const usePrepaymentStore = create<PrepaymentState>((set) => ({
  primary: emptyPriv,
  penaltyMethod: "IRD",
  rateKind: "Fixed",
  comparisonRatePct: 5.29,
  products: [],
  patchPrimary: (p) => set((s) => ({ primary: { ...s.primary, ...p } })),
  patch: (p) => set((s) => ({ ...s, ...p })),
  addProduct: () =>
    set((s) => ({
      products: [
        ...s.products,
        {
          id: uid(),
          lenderName: "",
          ratePct: 0,
          rateKind: "Fixed",
          termMonths: 60,
          penaltyMethod: "IRD",
          privileges: { ...emptyPriv },
          notes: "",
        },
      ],
    })),
  updateProduct: (id, patch) =>
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removeProduct: (id) =>
    set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
}));

/** Indicative penalty. balance and rates in %/CAD; monthsRemaining in months. */
export function indicativePenalty(params: {
  balance: number;
  contractRatePct: number;
  comparisonRatePct: number;
  monthsRemaining: number;
  method: PenaltyMethod;
}): number {
  const { balance, contractRatePct, comparisonRatePct, monthsRemaining, method } = params;
  if (balance <= 0) return 0;
  if (method === "3-Month Interest") {
    return balance * (contractRatePct / 100) * (3 / 12);
  }
  // IRD (simple indicative): balance * max(contract - comparison, 0) * remainingYears
  const diff = Math.max(contractRatePct - comparisonRatePct, 0) / 100;
  const years = Math.max(monthsRemaining, 0) / 12;
  return balance * diff * years;
}
