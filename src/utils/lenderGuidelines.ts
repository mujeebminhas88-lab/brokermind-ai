/**
 * Static lender-guideline library (NEW-I).
 * Reference-only. Always confirm current rules with the lender/BDM.
 */
export type LenderCategory = "A" | "B" | "Private";

export interface LenderGuideline {
  id: string;
  category: LenderCategory;
  name: string;
  updated: string; // ISO date
  maxLtv: string;
  minBeacon: string;
  stressTest: string;
  income: string;
  rental: string;
  notes: string[];
  restrictions: string[];
}

export const LENDER_GUIDELINES: LenderGuideline[] = [
  // ── A LENDERS ────────────────────────────────────────────────────────────
  {
    id: "big6",
    category: "A",
    name: "Big 6 Banks (RBC, TD, BMO, Scotia, CIBC, NBC)",
    updated: "2026-01-15",
    maxLtv: "95% owner-occupied insured · 80% conventional · 80% rental",
    minBeacon: "680 (Prime) — some programs require 720+",
    stressTest: "OSFI B-20: MAX(contract + 2%, 5.25%)",
    income: "2-yr T4 / T1 average; self-employed generally requires 2-yr NOA + T2125.",
    rental: "50% offset (owner-occupied 1–4) or DCR ≥ 1.10 (rentals).",
    notes: ["Prime pricing at Beacon 720+.", "Co-op properties generally declined."],
    restrictions: ["No leasehold (limited exceptions).", "Max 4 rentals financed per client.", "No mixed-use > 25% commercial."],
  },
  {
    id: "monoline",
    category: "A",
    name: "Monoline Lenders (MCAP, First National, Merix, RFA, RMG)",
    updated: "2026-01-15",
    maxLtv: "95% insured · 80% conventional",
    minBeacon: "680",
    stressTest: "OSFI B-20 (MQR).",
    income: "Standard salaried + 2-yr self-employed.",
    rental: "50% add-back typical.",
    notes: ["Broker-only channel — competitive rate holds (120 days common)."],
    restrictions: ["No private-sale transactions on some programs.", "Rural / acreage often capped at 10 acres."],
  },
  {
    id: "cu",
    category: "A",
    name: "Credit Unions (Meridian, Alterna, First Ontario)",
    updated: "2026-01-15",
    maxLtv: "80% conventional (some 95% insured)",
    minBeacon: "650–680 depending on program",
    stressTest: "Provincial CU — many exempt from OSFI B-20 stress test.",
    income: "More flexible on self-employed / commissioned income.",
    rental: "Case-by-case; DCR common.",
    notes: ["Membership required.", "Often used for stress-test-tight files."],
    restrictions: ["Provincially limited.", "Rate slightly above Big 6."],
  },
  // ── B LENDERS ────────────────────────────────────────────────────────────
  {
    id: "home-trust",
    category: "B",
    name: "Home Trust (Classic / Accelerator)",
    updated: "2026-01-15",
    maxLtv: "80% urban · 75% rural · 65% rental",
    minBeacon: "550 (Classic) · 600+ preferred",
    stressTest: "Uses contract rate + qualifying buffer per program.",
    income: "Bank-statement, stated income, and BFS programs available.",
    rental: "80% gross-rent add-back on some programs.",
    notes: ["Lender fee 1% typical.", "1-year term common; renewal fee at maturity."],
    restrictions: ["Max LTV drops sharply outside major urban centres."],
  },
  {
    id: "equitable",
    category: "B",
    name: "Equitable Bank (EQB) — Alt Suite",
    updated: "2026-01-15",
    maxLtv: "80% urban · 75% secondary · 65% rural",
    minBeacon: "600 typical",
    stressTest: "Contract rate qualification on some programs.",
    income: "Business-for-self flexible income.",
    rental: "Case-by-case add-back.",
    notes: ["Lender fee 1%.", "Bruised credit acceptable with story letter."],
    restrictions: ["Property must be readily marketable.", "Max GDS/TDS 39/44 on most files."],
  },
  {
    id: "cmls-alt",
    category: "B",
    name: "CMLS / CWB Optimum / Community Trust",
    updated: "2026-01-15",
    maxLtv: "80% owner-occupied · 75% rental",
    minBeacon: "620+",
    stressTest: "Contract + buffer typical.",
    income: "Alt-A programs — recent NOA sufficient for BFS.",
    rental: "50–80% add-back depending on program.",
    notes: ["Positioned between Prime and deep Alt."],
    restrictions: ["Not for deep credit repair — use MIC/Private."],
  },
  // ── PRIVATE ──────────────────────────────────────────────────────────────
  {
    id: "mic",
    category: "Private",
    name: "MIC / Mortgage Investment Corps (Atrium, Fisgard, Alta West)",
    updated: "2026-01-15",
    maxLtv: "75% urban 1st · 80% combined (1st + 2nd) · 65% rural",
    minBeacon: "No minimum (equity-based)",
    stressTest: "None — equity underwriting.",
    income: "Stated / minimal verification.",
    rental: "N/A (equity lend).",
    notes: [
      "Rate range 8.99–11.99% + 2% lender fee + 1% broker fee.",
      "Terms typically 12 months, interest-only.",
      "Exit strategy MANDATORY.",
    ],
    restrictions: ["Rural / recreational property discounted.", "No co-ops.", "Marketable properties only."],
  },
  {
    id: "private-individual",
    category: "Private",
    name: "Private / Individual Lenders",
    updated: "2026-01-15",
    maxLtv: "70–80% 1st · up to 85% combined with 2nd",
    minBeacon: "No minimum",
    stressTest: "None.",
    income: "Stated or none.",
    rental: "N/A.",
    notes: [
      "Rate range 10–14% + 2–3% lender fee.",
      "6–12 month terms common.",
      "Legal / appraisal deducted from advance.",
    ],
    restrictions: ["Second mortgages often limited to major urban centres."],
  },
];

export interface FileFacts {
  beacon: number | null;
  ltv: number;
  employmentType: "Salaried" | "Self-Employed" | "Incorporated" | null;
  yearsSelfEmployed: number | null;
  propertyKind: string;
  isRural: boolean;
  isLeasehold: boolean;
  hasCoOp: boolean;
  numUnits: number | null;
  commercialPct: number | null;
}

/** Return an array of highlighted-warning strings relevant to this file for a given guideline. */
export function highlightsForFile(g: LenderGuideline, f: FileFacts): string[] {
  const out: string[] = [];
  if (f.isLeasehold && g.category === "A") out.push("Leasehold — most A lenders decline.");
  if (f.isRural && g.id === "home-trust") out.push("Rural — Home Trust LTV drops to 75%.");
  if (f.hasCoOp && g.category === "A") out.push("Co-op property — Big 6 generally declined.");
  if (f.numUnits != null && f.numUnits >= 5 && g.category !== "Private")
    out.push("5+ units — commercial mortgage only.");
  if (f.commercialPct != null && f.commercialPct > 25 && g.category === "A")
    out.push("Mixed-use > 25% commercial — Alt/Private only.");
  if (f.employmentType && f.yearsSelfEmployed != null && f.yearsSelfEmployed < 2 && g.category === "A")
    out.push("Self-employed < 2 years — Alt lender only.");
  if (f.beacon != null && f.beacon < 680 && g.category === "A")
    out.push(`Beacon ${f.beacon} — below A-lender floor (680).`);
  if (f.beacon != null && f.beacon < 600 && g.category === "B")
    out.push(`Beacon ${f.beacon} — below B-lender floor (600).`);
  return out;
}
