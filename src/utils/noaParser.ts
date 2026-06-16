import { z } from "zod";

/* ──────────────────────────────────────────────────────────────
 * NOA structural contract — strict OSFI B-20 aligned payload.
 * ────────────────────────────────────────────────────────────── */

export const NoaPayloadSchema = z.object({
  tax_year: z.number().int().min(1990).max(2100),
  taxpayer_name: z.string().trim().min(1).max(200),
  line_15000_total_income: z.number().nonnegative(),
  line_23600_net_income: z.number().nonnegative(),
  balance_owing_at_assessment: z.number(),
  has_unarranged_arrears: z.boolean(),
  prior_year_line_15000: z.number().nonnegative().optional(),
  document_title_raw: z.string().max(500).optional(),
});

export type NoaPayload = z.infer<typeof NoaPayloadSchema>;

/* ──────────────────────────────────────────────────────────────
 * Risk taxonomy
 * ────────────────────────────────────────────────────────────── */

export type RiskFlagCode = "TAX-DROP-YOY" | "TAX-CRA-ARREARS" | "DOC-REASSESSMENT";

export type RiskFlag = {
  code: RiskFlagCode;
  title: string;
  detail: string;
  penalty: number;
  severity: "Low" | "Elevated" | "High";
};

export type NoaAnalysis = {
  payload: NoaPayload;
  flags: RiskFlag[];
  aggregatePenalty: number;
  generatedConditionId: string | null;
  draftedCondition: {
    id: string;
    title: string;
    category: string;
    internal: string;
    broker: string;
    borrower: string;
  } | null;
  evaluatedAt: string;
};

const REASSESSMENT_PATTERNS = [
  /reassessment/i,
  /re-?assessed/i,
  /t1\s*adjustment/i,
  /notice of reassessment/i,
];

/* ──────────────────────────────────────────────────────────────
 * Analyzer
 * ────────────────────────────────────────────────────────────── */

export function analyzeNoticeOfAssessment(input: unknown): NoaAnalysis {
  const payload = NoaPayloadSchema.parse(input);
  const flags: RiskFlag[] = [];

  // TAX-DROP-YOY (15 pts) — line 15000 declined YoY
  if (
    typeof payload.prior_year_line_15000 === "number" &&
    payload.prior_year_line_15000 > 0 &&
    payload.line_15000_total_income < payload.prior_year_line_15000
  ) {
    const dropPct =
      ((payload.prior_year_line_15000 - payload.line_15000_total_income) /
        payload.prior_year_line_15000) *
      100;
    flags.push({
      code: "TAX-DROP-YOY",
      title: "Year-over-year income decline",
      detail: `Line 15000 fell ${dropPct.toFixed(1)}% vs prior year (${fmt(
        payload.prior_year_line_15000
      )} → ${fmt(payload.line_15000_total_income)}).`,
      penalty: 15,
      severity: "Elevated",
    });
  }

  // TAX-CRA-ARREARS (25 pts)
  if (payload.balance_owing_at_assessment > 0 || payload.has_unarranged_arrears) {
    flags.push({
      code: "TAX-CRA-ARREARS",
      title: "CRA balance owing / unarranged arrears",
      detail: `Balance owing of ${fmt(
        payload.balance_owing_at_assessment
      )} detected at assessment. Priority lien risk.`,
      penalty: 25,
      severity: "High",
    });
  }

  // DOC-REASSESSMENT (10 pts)
  if (
    payload.document_title_raw &&
    REASSESSMENT_PATTERNS.some((rx) => rx.test(payload.document_title_raw!))
  ) {
    flags.push({
      code: "DOC-REASSESSMENT",
      title: "Reassessment / T1 Adjustment detected",
      detail: `Document title indicates a reassessment: "${payload.document_title_raw}". Verify final figures.`,
      penalty: 10,
      severity: "Elevated",
    });
  }

  const aggregatePenalty = flags.reduce((sum, f) => sum + f.penalty, 0);

  const draftedCondition = buildDraftedCondition(payload, flags);

  return {
    payload,
    flags,
    aggregatePenalty,
    generatedConditionId: draftedCondition?.id ?? null,
    draftedCondition,
    evaluatedAt: new Date().toLocaleString("en-CA", { hour12: false }),
  };
}

/* ──────────────────────────────────────────────────────────────
 * Drafted underwriting response (lead condition per flag set)
 * ────────────────────────────────────────────────────────────── */

function buildDraftedCondition(payload: NoaPayload, flags: RiskFlag[]) {
  if (flags.length === 0) return null;

  // Priority: arrears > reassessment > yoy drop
  const lead =
    flags.find((f) => f.code === "TAX-CRA-ARREARS") ??
    flags.find((f) => f.code === "DOC-REASSESSMENT") ??
    flags[0];

  const id = `NOA-${lead.code.split("-").pop()}-${payload.tax_year}`;
  const fileTag = `#APP-2025-08842`;

  if (lead.code === "TAX-CRA-ARREARS") {
    return {
      id,
      category: "Income / Tax",
      title: "Resolve CRA balance owing prior to instruction",
      internal: `CREDIT NOTE — FILE ${fileTag}
Applicant: ${payload.taxpayer_name}
Auto-generated from NOA upload (${payload.tax_year})

OBSERVATION
NOA shows balance owing of ${fmt(payload.balance_owing_at_assessment)}.
CRA arrears constitute a priority lien; must be cleared
or formally arranged before solicitor instruction.

RECOMMENDATION
Obtain (a) CRA receipt of payment in full, or (b) signed
CRA payment arrangement with 2 months of cleared payments.
Re-score INC component once provided.`,
      broker: `Hi team,

NOA upload for ${payload.taxpayer_name} flags an outstanding
CRA balance of ${fmt(payload.balance_owing_at_assessment)}.

Please provide ONE of:
  • CRA receipt confirming balance paid in full, OR
  • CRA payment arrangement + 2 mo. cleared payments.

— BrokerMindAI Adjudication Desk`,
      borrower: `Dear ${payload.taxpayer_name},

Your ${payload.tax_year} CRA Notice of Assessment shows a
balance owing of ${fmt(payload.balance_owing_at_assessment)}.

Please send either proof of payment in full, or your CRA
payment arrangement with two months of cleared payments.

Kind regards,
Adjudication Team`,
    };
  }

  if (lead.code === "DOC-REASSESSMENT") {
    return {
      id,
      category: "Documentation",
      title: "Confirm post-reassessment figures",
      internal: `CREDIT NOTE — FILE ${fileTag}
Applicant: ${payload.taxpayer_name}
Document classified as reassessment.

OBSERVATION
Title "${payload.document_title_raw}" indicates a CRA
reassessment. Underlying income/tax figures may have
changed since original NOA.

RECOMMENDATION
Obtain CRA "Statement of Account" or My Account snapshot
confirming current Line 15000 and outstanding balance.`,
      broker: `Hi team,

The document uploaded for ${payload.taxpayer_name} appears
to be a reassessment / T1 Adjustment. Please send the most
recent CRA Statement of Account so we can lock figures.

— BrokerMindAI Adjudication Desk`,
      borrower: `Dear ${payload.taxpayer_name},

We received a reassessment document for tax year
${payload.tax_year}. To finalize review, please share your
most recent CRA Statement of Account.

Kind regards,
Adjudication Team`,
    };
  }

  // TAX-DROP-YOY
  return {
    id,
    category: "Income",
    title: "Explain year-over-year income decline",
    internal: `CREDIT NOTE — FILE ${fileTag}
Applicant: ${payload.taxpayer_name}

OBSERVATION
Line 15000 fell from ${fmt(payload.prior_year_line_15000 ?? 0)} to
${fmt(payload.line_15000_total_income)} year-over-year.

RECOMMENDATION
Obtain written explanation of variance and supporting
documentation (employer letter, contract change, etc.).
Apply conservative qualifying income per OSFI B-20 §5.1.`,
    broker: `Hi team,

NOA for ${payload.taxpayer_name} shows a year-over-year
income decline. Please provide a brief written explanation
plus supporting documents.

— BrokerMindAI Adjudication Desk`,
    borrower: `Dear ${payload.taxpayer_name},

Your ${payload.tax_year} total income is lower than the prior
year. Please share a short note explaining the change and any
supporting documentation.

Kind regards,
Adjudication Team`,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Simulated parse pipeline (frontend stub)
 *
 * Real OCR happens server-side. For the demo we deterministically
 * project the uploaded file into one of three NOA scenarios so
 * the UI exercises every risk path.
 * ────────────────────────────────────────────────────────────── */

const SCENARIOS: NoaPayload[] = [
  {
    tax_year: 2025,
    taxpayer_name: "Mujeeb Minhas",
    line_15000_total_income: 94500,
    line_23600_net_income: 88940.12,
    balance_owing_at_assessment: 4250.31,
    has_unarranged_arrears: true,
    prior_year_line_15000: 93100,
    document_title_raw: "Notice of Assessment",
  },
  {
    tax_year: 2025,
    taxpayer_name: "Mujeeb Minhas",
    line_15000_total_income: 81200,
    line_23600_net_income: 76840,
    balance_owing_at_assessment: 0,
    has_unarranged_arrears: false,
    prior_year_line_15000: 96400,
    document_title_raw: "Notice of Reassessment — T1 Adjustment",
  },
  {
    tax_year: 2025,
    taxpayer_name: "Mujeeb Minhas",
    line_15000_total_income: 98750,
    line_23600_net_income: 92110,
    balance_owing_at_assessment: 0,
    has_unarranged_arrears: false,
    prior_year_line_15000: 95200,
    document_title_raw: "Notice of Assessment",
  },
];

export async function simulateParseNoaFromFile(file: File): Promise<NoaPayload> {
  // Allow users to drop a JSON payload to drive the schema directly.
  if (file.type === "application/json" || /\.json$/i.test(file.name)) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return NoaPayloadSchema.parse(parsed);
  }

  // Small delay to mimic OCR roundtrip.
  await new Promise((r) => setTimeout(r, 650));

  const hash = Array.from(file.name).reduce((a, c) => a + c.charCodeAt(0), 0);
  return SCENARIOS[hash % SCENARIOS.length];
}

/* ──────────────────────────────────────────────────────────────
 * helpers
 * ────────────────────────────────────────────────────────────── */

function fmt(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  });
}
