/**
 * Credit Profile store — Beacon score, trade line summary, derogatory
 * timeline, and lender-stream recommendation logic.
 *
 * Feeds Prompt 7 (Beacon Score & Credit Profile Module):
 *  - Tier classification (EXCELLENT / GOOD / FAIR / WEAK / PRIVATE)
 *  - Trade line & utilisation flags
 *  - Bankruptcy / Consumer Proposal seasoning countdowns
 *  - Auto lender stream recommendation
 *  - "Path to Prime" rebuilding actions when score < 680
 */
import { create } from "zustand";
import type { UnderwritingStream } from "@/utils/underwritingEngine";

export type BeaconTier = "EXCELLENT" | "GOOD" | "FAIR" | "WEAK" | "PRIVATE";

export interface BeaconTierMeta {
  tier: BeaconTier;
  label: string;
  description: string;
  color: string; // tailwind text color class
  bg: string;    // tailwind bg class
  border: string;
  bar: string;
  channel: UnderwritingStream;
}

export interface CreditProfileState {
  beacon: number | null;
  activeTrades: number;
  oldestTradeYears: number;
  revolvingUtilisationPct: number;
  hasCollections: boolean;
  hasJudgement: boolean;
  hasConsumerProposal: boolean;
  hasBankruptcy: boolean;
  /** ISO date (yyyy-mm-dd). */
  bankruptcyDischargeDate: string | null;
  /** ISO date (yyyy-mm-dd). */
  consumerProposalCompletionDate: string | null;

  patch: (p: Partial<CreditProfileState>) => void;
  reset: () => void;
}

const INITIAL: Omit<CreditProfileState, "patch" | "reset"> = {
  beacon: null,
  activeTrades: 0,
  oldestTradeYears: 0,
  revolvingUtilisationPct: 0,
  hasCollections: false,
  hasJudgement: false,
  hasConsumerProposal: false,
  hasBankruptcy: false,
  bankruptcyDischargeDate: null,
  consumerProposalCompletionDate: null,
};

export const useCreditProfileStore = create<CreditProfileState>((set) => ({
  ...INITIAL,
  patch: (p) => set((s) => ({ ...s, ...p })),
  reset: () => set({ ...INITIAL }),
}));

// -----------------------------------------------------------------------------
// Pure helpers
// -----------------------------------------------------------------------------

export function beaconTier(score: number | null): BeaconTierMeta {
  if (score == null || Number.isNaN(score)) {
    return {
      tier: "FAIR",
      label: "NOT ENTERED",
      description: "Enter a Beacon score to classify the applicant.",
      color: "text-muted-foreground",
      bg: "bg-muted",
      border: "border-border",
      bar: "bg-muted-foreground",
      channel: "Prime",
    };
  }
  if (score >= 760) {
    return {
      tier: "EXCELLENT",
      label: "EXCELLENT",
      description: "Top-tier pricing eligible with all A lenders.",
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/40",
      bar: "bg-success",
      channel: "Prime",
    };
  }
  if (score >= 700) {
    return {
      tier: "GOOD",
      label: "GOOD",
      description: "Standard A lender eligibility.",
      color: "text-chart-2",
      bg: "bg-chart-2/10",
      border: "border-chart-2/40",
      bar: "bg-chart-2",
      channel: "Prime",
    };
  }
  if (score >= 650) {
    return {
      tier: "FAIR",
      label: "FAIR",
      description: "A lender eligible with compensating factors; some Alt overlap.",
      color: "text-warning-fg",
      bg: "bg-warning-bg",
      border: "border-warning/40",
      bar: "bg-warning",
      channel: "Prime",
    };
  }
  if (score >= 600) {
    return {
      tier: "WEAK",
      label: "WEAK",
      description: "Alt / B lender territory. Prime highly unlikely.",
      color: "text-chart-4",
      bg: "bg-chart-4/10",
      border: "border-chart-4/40",
      bar: "bg-chart-4",
      channel: "Alt",
    };
  }
  return {
    tier: "PRIVATE",
    label: "PRIVATE / B LENDER",
    description: "Private / MIC lending only. Not eligible for Prime or most Alt.",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/40",
    bar: "bg-destructive",
    channel: "Private",
  };
}

function monthsBetween(from: Date, to: Date): number {
  const y = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  const dayAdj = to.getDate() < from.getDate() ? -1 : 0;
  return y * 12 + m + dayAdj;
}

export interface DerogatoryTimeline {
  type: "bankruptcy" | "consumer-proposal";
  eligibleAt: Date;
  monthsUntilEligible: number;
  eligible: boolean;
  label: string;
}

export function derogatoryTimelines(s: CreditProfileState, now: Date = new Date()): DerogatoryTimeline[] {
  const out: DerogatoryTimeline[] = [];
  if (s.hasBankruptcy && s.bankruptcyDischargeDate) {
    const d = new Date(s.bankruptcyDischargeDate);
    if (!Number.isNaN(d.getTime())) {
      const eligibleAt = new Date(d);
      eligibleAt.setFullYear(eligibleAt.getFullYear() + 2);
      const months = monthsBetween(now, eligibleAt);
      out.push({
        type: "bankruptcy",
        eligibleAt,
        monthsUntilEligible: Math.max(0, months),
        eligible: months <= 0,
        label: "Bankruptcy discharge + 2 years",
      });
    }
  }
  if (s.hasConsumerProposal && s.consumerProposalCompletionDate) {
    const d = new Date(s.consumerProposalCompletionDate);
    if (!Number.isNaN(d.getTime())) {
      const eligibleAt = new Date(d);
      eligibleAt.setFullYear(eligibleAt.getFullYear() + 3);
      const months = monthsBetween(now, eligibleAt);
      out.push({
        type: "consumer-proposal",
        eligibleAt,
        monthsUntilEligible: Math.max(0, months),
        eligible: months <= 0,
        label: "Consumer Proposal completion + 3 years",
      });
    }
  }
  return out;
}

export function hasActiveDerogatory(s: CreditProfileState, now: Date = new Date()): boolean {
  if (s.hasCollections || s.hasJudgement) return true;
  const timelines = derogatoryTimelines(s, now);
  return timelines.some((t) => !t.eligible);
}

/** Recommended lender stream based on beacon + derogatory state. */
export function recommendedStream(s: CreditProfileState, now: Date = new Date()): UnderwritingStream {
  const tier = beaconTier(s.beacon).channel;
  const activeDerog = hasActiveDerogatory(s, now);
  if (s.beacon != null && s.beacon < 600 && activeDerog) return "Private";
  if (tier === "Private") return "Private";
  if (activeDerog && tier === "Prime") return "Alt";
  return tier;
}

export interface CreditAlert {
  code: string;
  label: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "WARN";
  jumpTo: string;
}

export function computeCreditAlerts(
  s: CreditProfileState,
  selectedStream: UnderwritingStream,
  now: Date = new Date(),
): CreditAlert[] {
  const out: CreditAlert[] = [];
  if (s.beacon == null) {
    out.push({
      code: "CREDIT-NO-BEACON",
      label: "Beacon score missing",
      detail: "Enter the applicant's Beacon score to complete underwriting.",
      severity: "HIGH",
      jumpTo: "credit-profile",
    });
    return out;
  }
  const activeDerog = hasActiveDerogatory(s, now);
  if (s.beacon < 600 && activeDerog && selectedStream === "Prime") {
    out.push({
      code: "CREDIT-PRIME-INVALID",
      label: "Prime selected with sub-600 Beacon + active derogatory",
      detail: `Beacon ${s.beacon} with active derogatory items requires Private / MIC lending. Change lender stream.`,
      severity: "CRITICAL",
      jumpTo: "credit-profile",
    });
  }
  if (s.revolvingUtilisationPct > 65) {
    out.push({
      code: "CREDIT-UTIL-HIGH",
      label: "Revolving utilisation over 65%",
      detail: `Utilisation ${s.revolvingUtilisationPct.toFixed(0)}% may materially drag Beacon. Paydown recommended pre-funding.`,
      severity: "WARN",
      jumpTo: "credit-profile",
    });
  }
  if (s.hasCollections) {
    out.push({
      code: "CREDIT-COLLECTIONS",
      label: "Active collection(s)",
      detail: "Most A lenders require collections resolved and paid pre-funding.",
      severity: "HIGH",
      jumpTo: "credit-profile",
    });
  }
  if (s.hasJudgement) {
    out.push({
      code: "CREDIT-JUDGEMENT",
      label: "Judgement on file",
      detail: "Judgement must be discharged or documented as satisfied.",
      severity: "HIGH",
      jumpTo: "credit-profile",
    });
  }
  return out;
}

export interface PathToPrimeAction {
  title: string;
  detail: string;
}

export function pathToPrime(s: CreditProfileState): PathToPrimeAction[] | null {
  if (s.beacon == null || s.beacon >= 680) return null;
  const actions: PathToPrimeAction[] = [];
  if (s.revolvingUtilisationPct > 30) {
    actions.push({
      title: `Reduce revolving utilisation from ${s.revolvingUtilisationPct.toFixed(0)}% to under 30%`,
      detail: "Utilisation is ~30% of the FICO/Beacon calculation. Paying revolvers below 30% typically moves the score 20–40 points within one cycle.",
    });
  }
  if (s.hasCollections) {
    actions.push({
      title: "Resolve outstanding collection(s)",
      detail: "Pay and obtain a written confirmation; request 'paid in full' reporting.",
    });
  }
  if (s.activeTrades < 3) {
    actions.push({
      title: "Establish two additional trade lines with 6+ months of clean history",
      detail: "A lenders generally require 2–3 trades reporting for 12 months. Consider a secured card + retail line.",
    });
  }
  if (s.oldestTradeYears < 2) {
    actions.push({
      title: "Season existing trades to 2+ years",
      detail: "Length of credit history is ~15% of the score. Keep the oldest trade open and active.",
    });
  }
  if (actions.length === 0) {
    actions.push({
      title: "Maintain flawless payment history for 6 months",
      detail: "Payment history is 35% of the score. No missed or late payments across all trades.",
    });
  }
  return actions.slice(0, 3);
}
