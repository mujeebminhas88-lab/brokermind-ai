/**
 * AML / FINTRAC compliance store — client-side state for the mandatory
 * FINTRAC checklist. Alerts are surfaced through useComplianceAlerts and
 * gate the dossier through computeGateStatus.
 */
import { create } from "zustand";

export type PrimaryIdType = "" | "Passport" | "Driver's Licence" | "PR Card";
export type SecondaryIdType = "" | "Passport" | "Driver's Licence" | "PR Card" | "Health Card" | "Bank Statement" | "Utility Bill";
export type VerificationMethod = "" | "In-person" | "Dual process" | "Video";

export interface AmlState {
  primaryIdType: PrimaryIdType;
  primaryIdUploaded: boolean;
  secondaryIdType: SecondaryIdType;
  secondaryIdUploaded: boolean;
  verificationMethod: VerificationMethod;
  verificationDate: string;

  isPep: boolean | null;
  isThirdParty: boolean | null;
  thirdPartyName: string;
  thirdPartyRelationship: string;
  thirdPartyReason: string;

  isLargeCash: boolean | null;
  suspiciousNotes: string;

  patch: (p: Partial<AmlState>) => void;
  reset: () => void;
}

const DEFAULT: Omit<AmlState, "patch" | "reset"> = {
  primaryIdType: "",
  primaryIdUploaded: false,
  secondaryIdType: "",
  secondaryIdUploaded: false,
  verificationMethod: "",
  verificationDate: "",
  isPep: null,
  isThirdParty: null,
  thirdPartyName: "",
  thirdPartyRelationship: "",
  thirdPartyReason: "",
  isLargeCash: null,
  suspiciousNotes: "",
};

export const useAmlStore = create<AmlState>((set) => ({
  ...DEFAULT,
  patch: (p) => set((s) => ({ ...s, ...p })),
  reset: () => set(DEFAULT),
}));

export interface AmlAlert {
  code: string;
  label: string;
  detail: string;
  severity: "CRITICAL";
  jumpTo: string;
}

export function computeAmlCompletion(s: AmlState): {
  complete: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!s.primaryIdType) missing.push("Primary ID type");
  if (!s.primaryIdUploaded) missing.push("Primary ID upload");
  if (!s.secondaryIdType) missing.push("Secondary ID type");
  if (!s.secondaryIdUploaded) missing.push("Secondary ID upload");
  if (!s.verificationMethod) missing.push("Verification method");
  if (!s.verificationDate) missing.push("Verification date");
  if (s.isPep === null) missing.push("PEP / HIO screening");
  if (s.isThirdParty === null) missing.push("Third-party determination");
  if (s.isThirdParty === true) {
    if (!s.thirdPartyName.trim()) missing.push("Third-party name");
    if (!s.thirdPartyRelationship.trim()) missing.push("Third-party relationship");
    if (!s.thirdPartyReason.trim()) missing.push("Third-party reason");
  }
  if (s.isLargeCash === null) missing.push("Large cash transaction determination");
  return { complete: missing.length === 0, missing };
}

export function computeAmlAlerts(s: AmlState): AmlAlert[] {
  const out: AmlAlert[] = [];
  const { complete, missing } = computeAmlCompletion(s);
  if (!complete) {
    out.push({
      code: "AML-IDV-INCOMPLETE",
      label: "AML / FINTRAC checklist incomplete",
      detail: `Missing: ${missing.join(", ")}.`,
      severity: "CRITICAL",
      jumpTo: "aml-panel",
    });
  }
  if (s.isPep === true) {
    out.push({
      code: "AML-PEP",
      label: "Politically Exposed Person",
      detail: "Enhanced due diligence required. Document source of wealth, senior management approval, and ongoing monitoring.",
      severity: "CRITICAL",
      jumpTo: "aml-panel",
    });
  }
  if (s.isLargeCash === true) {
    out.push({
      code: "FINTRAC-LCT",
      label: "Large Cash Transaction (>$10,000)",
      detail: "Mandatory FINTRAC Large Cash Transaction Report must be filed within 15 days.",
      severity: "CRITICAL",
      jumpTo: "aml-panel",
    });
  }
  if (s.suspiciousNotes.trim().length > 0) {
    out.push({
      code: "FINTRAC-STR",
      label: "Suspicious transaction indicators noted",
      detail: s.suspiciousNotes.trim().slice(0, 240),
      severity: "CRITICAL",
      jumpTo: "aml-panel",
    });
  }
  return out;
}
