/**
 * Communication templates library — Prompt 10.
 * Renders "AI-personalised" emails via variable substitution.
 */
export type TemplateKey =
  | "app-received"
  | "missing-docs"
  | "conditional-approval"
  | "conditions-reminder"
  | "approval"
  | "decline"
  | "rate-hold-expiry"
  | "renewal-90"
  | "renewal-60"
  | "renewal-30";

export interface TemplateContext {
  clientName: string;
  propertyAddress: string;
  brokerName: string;
  brokerageName: string;
  brokerEmail: string;
  brokerPhone: string;
  brokerLicence: string;
  signature: string;
  missingDocs?: string[];
  outstandingConditions?: string[];
  currentRate?: number;
  maturityDate?: string;
  approvalConditions?: string[];
  alternatives?: string[];
  rateHoldExpiryDate?: string;
  daysToExpiry?: number;
  loanAmount?: number;
}

export interface RenderedTemplate {
  subject: string;
  body: string;
}

export interface TemplateMeta {
  key: TemplateKey;
  label: string;
  category: "Onboarding" | "Documents" | "Approval" | "Renewal" | "Rate Hold";
  description: string;
}

export const TEMPLATE_LIBRARY: TemplateMeta[] = [
  { key: "app-received", label: "Application Received Confirmation", category: "Onboarding", description: "Acknowledge new file and outline next steps." },
  { key: "missing-docs", label: "Missing Documents Request", category: "Documents", description: "Auto-lists outstanding docs from registry." },
  { key: "conditional-approval", label: "Conditional Approval Notification", category: "Approval", description: "Announce conditional approval + conditions." },
  { key: "conditions-reminder", label: "Conditions Fulfillment Reminder", category: "Approval", description: "Reminder for outstanding conditions." },
  { key: "approval", label: "Approval Congratulations", category: "Approval", description: "Final approval confirmation." },
  { key: "decline", label: "Decline with Alternatives", category: "Approval", description: "Decline note with alternative pathways." },
  { key: "rate-hold-expiry", label: "Rate Hold Expiry Warning", category: "Rate Hold", description: "Warn of expiring rate hold." },
  { key: "renewal-90", label: "Renewal Outreach — 90 Day", category: "Renewal", description: "Early renewal outreach." },
  { key: "renewal-60", label: "Renewal Outreach — 60 Day", category: "Renewal", description: "Mid-window renewal outreach." },
  { key: "renewal-30", label: "Renewal Outreach — 30 Day", category: "Renewal", description: "Urgent renewal outreach." },
];

const list = (items?: string[]) =>
  !items || items.length === 0 ? "  · (none on file)" : items.map((i) => `  · ${i}`).join("\n");

const fmtCurrency = (n?: number) =>
  n == null ? "" : n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function renderTemplate(key: TemplateKey, ctx: TemplateContext): RenderedTemplate {
  const sig = ctx.signature?.trim() ||
    `${ctx.brokerName || "Your Broker"}\n${ctx.brokerageName || ""}\nLicence: ${ctx.brokerLicence || "—"}\n${ctx.brokerEmail || ""} · ${ctx.brokerPhone || ""}`;

  const salutation = `Hi ${ctx.clientName || "there"},`;
  const property = ctx.propertyAddress ? ` for ${ctx.propertyAddress}` : "";

  switch (key) {
    case "app-received":
      return {
        subject: `Your mortgage application${property} has been received`,
        body:
`${salutation}

Thanks for choosing ${ctx.brokerageName || "us"} to guide your mortgage${property}. I've received your application and it's now moving into review.

Next steps on my side:
  · Verify all supplied documents
  · Run affordability, stress test, and lender-matching
  · Reach out with any additional info needed

Typical response time: 1–2 business days.

Best regards,
${sig}`,
      };

    case "missing-docs":
      return {
        subject: `Documents required to advance your application${property}`,
        body:
`${salutation}

To keep your file moving I need the following documents:

${list(ctx.missingDocs)}

You can reply to this email with attachments or upload securely through the portal. Let me know if any item is unclear.

${sig}`,
      };

    case "conditional-approval":
      return {
        subject: `Conditional approval — mortgage${property}`,
        body:
`${salutation}

Great news — the lender has issued a CONDITIONAL APPROVAL${property}. To move to final approval, we'll need to satisfy the following conditions:

${list(ctx.approvalConditions ?? ctx.outstandingConditions)}

I'll walk you through each one. Reply when you're ready to start.

${sig}`,
      };

    case "conditions-reminder":
      return {
        subject: `Reminder: outstanding conditions on your file${property}`,
        body:
`${salutation}

Quick reminder — the following conditions are still outstanding on your approval:

${list(ctx.outstandingConditions)}

We need these satisfied before instructing to lawyers. Let me know how I can help.

${sig}`,
      };

    case "approval":
      return {
        subject: `Approved! Your mortgage${property}`,
        body:
`${salutation}

Congratulations — your mortgage${property} is fully approved${ctx.loanAmount ? ` at ${fmtCurrency(ctx.loanAmount)}` : ""}. I'll be sending instructions to your lawyer this week.

I'll be your point of contact through closing and beyond — please reach out any time.

${sig}`,
      };

    case "decline":
      return {
        subject: `Update on your mortgage application${property}`,
        body:
`${salutation}

Unfortunately the lender has declined the current submission${property}. This is not the end of the road — I've already identified alternative paths for us to explore:

${list(ctx.alternatives ?? ["Alternative A-lender program", "B-lender product with 12-month exit", "Credit repair plan (6–12 months) to re-submit to Prime"])}

Let's schedule 15 minutes to walk through options and next steps.

${sig}`,
      };

    case "rate-hold-expiry":
      return {
        subject: `Your rate hold expires ${ctx.rateHoldExpiryDate ?? "soon"} — action required`,
        body:
`${salutation}

Your rate hold${ctx.rateHoldExpiryDate ? ` expires on ${ctx.rateHoldExpiryDate}` : ""}${ctx.daysToExpiry != null ? ` (${ctx.daysToExpiry} days away)` : ""}. To lock the protected rate, we need to submit or extend before that date.

Reply to this email today and I'll take it from there.

${sig}`,
      };

    case "renewal-90":
    case "renewal-60":
    case "renewal-30": {
      const window = key === "renewal-90" ? "90 days" : key === "renewal-60" ? "60 days" : "30 days";
      const urgency =
        key === "renewal-30"
          ? "This is a time-sensitive window — most lenders lock in rates 30–120 days out."
          : "Rates are moving weekly — early planning gives us leverage.";
      return {
        subject: `Your mortgage renewal is coming up (${window})`,
        body:
`${salutation}

Your mortgage${property} matures on ${ctx.maturityDate ?? "the coming period"}. Your current contract rate is ${ctx.currentRate != null ? `${ctx.currentRate.toFixed(2)}%` : "on file"}.

${urgency}

I've been tracking the market and can prepare a side-by-side comparison of options — including your current lender's renewal offer versus what we can secure elsewhere. Reply to schedule a 15-minute review.

${sig}`,
      };
    }
  }
}
