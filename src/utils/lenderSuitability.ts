/**
 * Lender Suitability engine (Prompt 14).
 * Pure logic — derives Prime / Alt / Private recommendation with reasons
 * from credit profile + derived financials + property eligibility.
 */
import type { DerivedFinancials } from "@/store/applicationStore";
import type { CreditProfileState } from "@/store/creditProfileStore";
import type { LenderEligibility } from "@/store/propertyStore";

export type SuitabilityTier = "Prime" | "Alt" | "Private";

export interface SuitabilityRecommendation {
  tier: SuitabilityTier;
  reasons: string[];
  criticalFlags: string[];
  rateRange: string;
  notes: string[];
}

export function computeSuitability(
  credit: CreditProfileState,
  financials: DerivedFinancials,
  propertyElig: LenderEligibility | null,
  employmentType: "Salaried" | "Self-Employed" | "Incorporated" | null,
): SuitabilityRecommendation {
  const reasons: string[] = [];
  const criticalFlags: string[] = [];
  let tier: SuitabilityTier = "Prime";

  const beacon = credit.beacon ?? 0;
  const hasActiveDerog =
    credit.hasCollections || credit.hasJudgement || credit.hasBankruptcy || credit.hasConsumerProposal;

  // Beacon-driven tier
  if (beacon === 0) {
    reasons.push("Beacon score not entered — assuming Prime pending credit pull.");
  } else if (beacon < 600) {
    tier = "Private";
    reasons.push(`Beacon ${beacon} — below B-lender threshold (600).`);
  } else if (beacon < 680) {
    tier = "Alt";
    reasons.push(`Beacon ${beacon} — Alt/B territory (Prime requires ≥ 680).`);
  } else {
    reasons.push(`Beacon ${beacon} — meets Prime threshold.`);
  }

  // LTV
  const ltv = financials.ltv;
  if (ltv > 80 && !financials.cmhc.eligible) {
    if (tier === "Prime") tier = "Alt";
    reasons.push(`LTV ${ltv.toFixed(1)}% > 80% and CMHC ineligible — conventional Prime blocked.`);
  } else if (ltv > 80) {
    reasons.push(`LTV ${ltv.toFixed(1)}% > 80% — CMHC insurance required.`);
  } else {
    reasons.push(`LTV ${ltv.toFixed(1)}% — within conventional limits.`);
  }

  // GDS/TDS
  const stress = financials.stress;
  if (stress.gds > stress.gdsCap) {
    if (tier === "Prime") tier = "Alt";
    reasons.push(`GDS ${stress.gds.toFixed(1)}% exceeds cap ${stress.gdsCap.toFixed(0)}%.`);
  }
  if (stress.tds > stress.tdsCap) {
    if (tier === "Prime") tier = "Alt";
    reasons.push(`TDS ${stress.tds.toFixed(1)}% exceeds cap ${stress.tdsCap.toFixed(0)}%.`);
  }

  // Derogatory
  if (hasActiveDerog) {
    const items = [
      credit.hasCollections && "collections",
      credit.hasJudgement && "judgement",
      credit.hasBankruptcy && "bankruptcy",
      credit.hasConsumerProposal && "consumer proposal",
    ].filter(Boolean) as string[];
    reasons.push(`Active derogatory items: ${items.join(", ")}.`);
    if (tier === "Prime") tier = "Alt";
    if (beacon < 600) tier = "Private";
    if (credit.bankruptcyDischargeDate) {
      const yearsSince = yearsBetween(credit.bankruptcyDischargeDate);
      if (yearsSince < 2) reasons.push(`Bankruptcy discharged ${yearsSince.toFixed(1)}y ago — A lender eligible at 2y.`);
    }
    if (credit.consumerProposalCompletionDate) {
      const yearsSince = yearsBetween(credit.consumerProposalCompletionDate);
      if (yearsSince < 3) reasons.push(`Consumer proposal completed ${yearsSince.toFixed(1)}y ago — A lender eligible at 3y.`);
    }
  }

  // Employment complexity
  if (employmentType === "Self-Employed" || employmentType === "Incorporated") {
    reasons.push(`${employmentType} — income complexity may push to Alt lender.`);
    if (tier === "Prime" && beacon < 720) tier = "Alt";
  }

  // Property eligibility
  if (propertyElig) {
    if (propertyElig.prime === "ineligible") {
      if (tier === "Prime") tier = "Alt";
      reasons.push("Property type ineligible for Prime lenders.");
    } else if (propertyElig.prime === "restricted") {
      reasons.push("Property type restricted for many Prime lenders.");
    }
    if (propertyElig.alt === "ineligible") {
      tier = "Private";
      reasons.push("Property type ineligible for Alt/B lenders — Private/Commercial only.");
    }
  }

  // Critical flags
  if (tier === "Private" && !hasActiveDerog && beacon >= 600) {
    criticalFlags.push("Private recommended but no clear derogatory driver — verify.");
  }
  if (beacon < 600 && hasActiveDerog) {
    criticalFlags.push("Beacon < 600 with active derogatory — Prime selection would be INVALID.");
  }

  // Rate range (indicative)
  const rateRange =
    tier === "Prime"
      ? "4.79% – 5.29% (fixed, 5-yr, indicative)"
      : tier === "Alt"
        ? "5.99% – 7.49% (fixed, 1–2 yr, indicative, plus lender fee 1%)"
        : "8.99% – 12.99% + 2–3% lender fee (Private/MIC, 12–24 month term)";

  const notes =
    tier === "Prime"
      ? ["Standard OSFI B-20 stress test applies.", "Fully income-verified qualification."]
      : tier === "Alt"
        ? [
            "Higher LTV thresholds by property type (typically 65–80%).",
            "Bank statement / stated income programs available.",
            "Lender fee typically 1% of loan amount.",
          ]
        : [
            "Exit strategy assessment REQUIRED before submission.",
            "Interest-only common; balloon at term end.",
            "Broker & lender fees deducted from advance.",
          ];

  return { tier, reasons, criticalFlags, rateRange, notes };
}

function yearsBetween(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return (Date.now() - then) / (365.25 * 24 * 60 * 60 * 1000);
}
