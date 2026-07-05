/**
 * Lender policy engine — evaluates an application against a firm's configured
 * underwriting thresholds and returns a set of policy breaches. These are
 * labelled 'POLICY BREACH' and displayed separately from generic compliance
 * flags.
 */

export interface LenderPolicy {
  id: string;
  firm_id: string;
  name: string;
  version: number;
  is_active: boolean;
  max_ltv_detached: number | null;
  max_ltv_condo: number | null;
  max_ltv_rural: number | null;
  min_beacon: number | null;
  max_tds: number | null;
  max_gds: number | null;
  acceptable_income_types: string[];
  eligible_provinces: string[];
  notes: string | null;
}

export interface PolicyInput {
  property_type?: "detached" | "condo" | "rural" | string | null;
  ltv?: number | null;
  beacon?: number | null;
  tds?: number | null;
  gds?: number | null;
  income_type?: string | null;
  province?: string | null;
}

export interface PolicyBreach {
  code: string;
  message: string;
  severity: "warn" | "block";
}

export function evaluatePolicy(input: PolicyInput, policy: LenderPolicy): PolicyBreach[] {
  const b: PolicyBreach[] = [];
  const ltv = input.ltv ?? null;
  const t = (input.property_type ?? "").toLowerCase();
  const maxLtv =
    t.includes("condo")
      ? policy.max_ltv_condo
      : t.includes("rural")
        ? policy.max_ltv_rural
        : policy.max_ltv_detached;

  if (maxLtv != null && ltv != null && ltv > maxLtv) {
    b.push({ code: "LTV_EXCEEDED", message: `LTV ${ltv}% exceeds policy max ${maxLtv}% for ${t || "property"}`, severity: "block" });
  }
  if (policy.min_beacon != null && input.beacon != null && input.beacon < policy.min_beacon) {
    b.push({ code: "BEACON_TOO_LOW", message: `Beacon ${input.beacon} below policy floor ${policy.min_beacon}`, severity: "block" });
  }
  if (policy.max_tds != null && input.tds != null && input.tds > policy.max_tds) {
    b.push({ code: "TDS_EXCEEDED", message: `TDS ${input.tds}% exceeds policy max ${policy.max_tds}%`, severity: "block" });
  }
  if (policy.max_gds != null && input.gds != null && input.gds > policy.max_gds) {
    b.push({ code: "GDS_EXCEEDED", message: `GDS ${input.gds}% exceeds policy max ${policy.max_gds}%`, severity: "warn" });
  }
  if (
    policy.acceptable_income_types.length > 0 &&
    input.income_type &&
    !policy.acceptable_income_types.includes(input.income_type)
  ) {
    b.push({ code: "INCOME_INELIGIBLE", message: `Income type "${input.income_type}" not on this policy's accept list`, severity: "block" });
  }
  if (
    policy.eligible_provinces.length > 0 &&
    input.province &&
    !policy.eligible_provinces.includes(input.province.toUpperCase())
  ) {
    b.push({ code: "PROVINCE_INELIGIBLE", message: `Property province ${input.province} not on this policy's accept list`, severity: "block" });
  }
  return b;
}
