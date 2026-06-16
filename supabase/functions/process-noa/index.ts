// Lovable Cloud Edge Function: process-noa
// Accepts a Base64-encoded NOA document + parent application_id and
// returns a structured payload that conforms to the BrokerMindAI NOA
// data contract (OSFI B-20 aligned).
//
// In production this would route the bytes through an OCR / LLM
// extraction provider. For the demo, we deterministically project the
// file size into one of three realistic scenarios so the frontend
// exercises every risk path. JSON uploads are honored verbatim.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NoaPayload = {
  tax_year: number;
  taxpayer_name: string;
  line_15000_total_income: number;
  line_23600_net_income: number;
  balance_owing_at_assessment: number;
  has_unarranged_arrears: boolean;
  prior_year_line_15000?: number;
  document_title_raw?: string;
};

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse(
        { error: "INVALID_REQUEST", message: "Missing JSON body." },
        400,
      );
    }

    const { fileData, fileName, mimeType, application_id } = body as {
      fileData?: string;
      fileName?: string;
      mimeType?: string;
      application_id?: string;
    };

    if (!fileData || typeof fileData !== "string") {
      return jsonResponse(
        {
          error: "INVALID_DOCUMENT_TYPE",
          message: "fileData (base64) is required.",
        },
        400,
      );
    }

    // Decode base64 to get byte length (also validates encoding).
    let bytes: Uint8Array;
    try {
      const clean = fileData.includes(",") ? fileData.split(",")[1] : fileData;
      const bin = atob(clean);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return jsonResponse(
        {
          error: "OCR_EXTRACTION_FAILURE",
          message: "Document bytes could not be decoded.",
        },
        422,
      );
    }

    // Honor JSON uploads verbatim (lets QA drive specific scenarios).
    if (mimeType === "application/json" || /\.json$/i.test(fileName ?? "")) {
      try {
        const text = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(text) as NoaPayload;
        return jsonResponse({ payload: parsed, application_id });
      } catch {
        return jsonResponse(
          {
            error: "INVALID_DOCUMENT_TYPE",
            message: "JSON payload could not be parsed.",
          },
          422,
        );
      }
    }

    // Reject obviously non-document binaries.
    if (bytes.length < 64) {
      return jsonResponse(
        {
          error: "OCR_EXTRACTION_FAILURE",
          message: "Document is empty or unreadable.",
        },
        422,
      );
    }

    // Simulate OCR roundtrip latency.
    await new Promise((r) => setTimeout(r, 850));

    // Deterministic scenario selection based on file size + name hash.
    const nameHash = Array.from(fileName ?? "noa").reduce(
      (a, c) => a + c.charCodeAt(0),
      0,
    );
    const idx = (bytes.length + nameHash) % SCENARIOS.length;
    const payload = SCENARIOS[idx];

    return jsonResponse({ payload, application_id: application_id ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected server error.";
    return jsonResponse(
      { error: "OCR_EXTRACTION_FAILURE", message },
      500,
    );
  }
});
