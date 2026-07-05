/**
 * Subject Property store (NEW-E + NEW-F).
 * Property details, condo/leasehold, appraisal, and lender restriction flags.
 */
import { create } from "zustand";

export type Tenure = "Freehold" | "Leasehold" | "Condo Freehold" | "Condo Leasehold";
export type PropertyKind =
  | "Detached"
  | "Semi-detached"
  | "Townhouse"
  | "Condo"
  | "Multi-unit"
  | "Rural";
export type HeatingType = "Gas" | "Electric" | "Oil" | "Wood" | "";
export type Condition = "Good" | "Average" | "Below Average" | "";
export type AppraisalStatus = "Not ordered" | "Ordered" | "Received";
export type DepreciationStatus = "Current" | "Overdue" | "Not Required" | "";

export interface PropertyState {
  // Address
  street: string;
  city: string;
  province: string;
  postal: string;

  // Classification
  tenure: Tenure;
  kind: PropertyKind;

  // Age & condition
  yearBuilt: number | null;
  heating: HeatingType;
  condition: Condition;

  // Condo-specific
  depreciationStatus: DepreciationStatus;
  specialLevyOutstanding: boolean;
  buildingAgeYears: number | null;
  buildingUnits: number | null;

  // Leasehold
  leaseExpiryYear: number | null;
  leaseholder: string;

  // Appraisal
  appraisalStatus: AppraisalStatus;
  appraisedValue: number | null;
  appraiserName: string;
  appraiserFirm: string;

  // Rural / multi-unit
  wellWater: boolean;
  septicSystem: boolean;
  acreage: number | null;
  numUnits: number | null;
  commercialPortionPct: number | null;

  patch: (p: Partial<PropertyState>) => void;
}

const INITIAL: Omit<PropertyState, "patch"> = {
  street: "",
  city: "",
  province: "",
  postal: "",
  tenure: "Freehold",
  kind: "Detached",
  yearBuilt: null,
  heating: "",
  condition: "",
  depreciationStatus: "",
  specialLevyOutstanding: false,
  buildingAgeYears: null,
  buildingUnits: null,
  leaseExpiryYear: null,
  leaseholder: "",
  appraisalStatus: "Not ordered",
  appraisedValue: null,
  appraiserName: "",
  appraiserFirm: "",
  wellWater: false,
  septicSystem: false,
  acreage: null,
  numUnits: null,
  commercialPortionPct: null,
};

export const usePropertyStore = create<PropertyState>((set) => ({
  ...INITIAL,
  patch: (p) => set((s) => ({ ...s, ...p })),
}));

// ─── Restriction analysis ──────────────────────────────────────────────────
export type StreamEligibility = "eligible" | "restricted" | "ineligible";

export interface LenderEligibility {
  prime: StreamEligibility;
  alt: StreamEligibility;
  private: StreamEligibility;
  notes: string[];
}

export function analyzeEligibility(
  p: PropertyState,
  purchasePrice: number,
  amortYears: number,
): LenderEligibility {
  const notes: string[] = [];
  let prime: StreamEligibility = "eligible";
  let alt: StreamEligibility = "eligible";
  const priv: StreamEligibility = "eligible";

  // Pre-1950
  if (p.yearBuilt != null && p.yearBuilt < 1950) {
    notes.push("Pre-1950 construction — additional lender requirements (WETT, updates).");
  }
  // Oil heat
  if (p.heating === "Oil") {
    prime = "restricted";
    notes.push("Oil heating restricted by most A lenders (tank age & insurance certificate required).");
  }
  // Condition
  if (p.condition === "Below Average") {
    notes.push("Below Average condition — appraisal + possibly cost-to-cure required.");
  }
  // Leasehold
  if (p.tenure === "Leasehold" || p.tenure === "Condo Leasehold") {
    prime = "restricted";
    notes.push("Leasehold — most A lenders decline; specialty lenders only.");
    if (p.leaseExpiryYear != null) {
      const remaining = p.leaseExpiryYear - new Date().getFullYear();
      if (remaining < amortYears + 5) {
        prime = "ineligible";
        alt = "restricted";
        notes.push(`Lease expires in ~${remaining}y — shorter than amortization + 5y buffer.`);
      }
    }
  }
  // Condo special levy
  if (p.specialLevyOutstanding) {
    notes.push("Outstanding special levy — most lenders require payoff prior to funding.");
  }
  if (p.depreciationStatus === "Overdue") {
    prime = prime === "eligible" ? "restricted" : prime;
    notes.push("Depreciation report overdue — Prime lenders may require current report.");
  }
  // Rural
  if (p.kind === "Rural") {
    prime = "restricted";
    notes.push("Rural property — several A lenders restrict to urban centres.");
  }
  if (p.wellWater || p.septicSystem) {
    notes.push("Well/septic — potability + inspection reports required.");
  }
  if (p.acreage != null && p.acreage > 10) {
    prime = "restricted";
    notes.push("Acreage > 10 — most residential lenders cap at 10 acres.");
  }
  // Multi-unit
  const units = p.numUnits ?? 0;
  if (p.kind === "Multi-unit" || units >= 3) {
    if (units >= 5) {
      prime = "ineligible";
      alt = "ineligible";
      notes.push("5+ units — commercial mortgage only.");
    } else if (units >= 3) {
      notes.push("3–4 units — insured mortgage available but higher down payment.");
    }
  }
  // Mixed use
  if (p.commercialPortionPct != null && p.commercialPortionPct > 25) {
    prime = "ineligible";
    alt = "restricted";
    notes.push("Commercial portion > 25% — Alt/Private only.");
  }
  // Appraised value
  if (p.appraisedValue != null && purchasePrice > 0 && p.appraisedValue < purchasePrice) {
    notes.push(
      `CRITICAL: Appraised value ($${p.appraisedValue.toLocaleString()}) below purchase price — LTV must be recalculated on lower value.`,
    );
  }

  return { prime, alt, private: priv, notes };
}
