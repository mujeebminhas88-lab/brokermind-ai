// Forensic Parsing Engine
// Universal document parser + variance/CRA arrears detection.
// Writes findings into public.compliance_alerts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DocumentCode =
  | "T1" | "T2" | "T4" | "T4A" | "T5" | "T2125" | "T5013" | "NOA"
  | "BANK_STATEMENT" | "INVOICE" | "UNKNOWN";

interface ParseRequest {
  application_id?: string;
  document_code?: DocumentCode;
  filename?: string;
  // Optional raw text (from prior OCR) or pre-extracted fields:
  ocr_text?: string;
  fields?: Record<string, unknown>;
}

interface ParsedDoc {
  document_code: DocumentCode;
  fields: Record<string, number | string | boolean>;
}

// --- Universal type identifier (filename + text heuristics) -----------------
function identifyDocument(req: ParseRequest): DocumentCode {
  if (req.document_code && req.document_code !== "UNKNOWN") return req.document_code;
  const hay = `${req.filename ?? ""} ${req.ocr_text ?? ""}`.toUpperCase();
  if (/NOTICE OF ASSESSMENT|\bNOA\b/.test(hay)) return "NOA";
  if (/\bT2125\b|STATEMENT OF BUSINESS/.test(hay)) return "T2125";
  if (/\bT4A\b/.test(hay)) return "T4A";
  if (/\bT4\b|STATEMENT OF REMUNERATION/.test(hay)) return "T4";
  if (/\bT5013\b/.test(hay)) return "T5013";
  if (/\bT5\b/.test(hay)) return "T5";
  if (/\bT2\b|CORPORATION INCOME TAX/.test(hay)) return "T2";
  if (/\bT1\b|INCOME TAX AND BENEFIT RETURN/.test(hay)) return "T1";
  if (/BANK STATEMENT|ACCOUNT SUMMARY|OPENING BALANCE/.test(hay)) return "BANK_STATEMENT";
  if (/INVOICE|BILL TO|AMOUNT DUE/.test(hay)) return "INVOICE";
  return "UNKNOWN";
}

// --- Field extractors --------------------------------------------------------
function num(re: RegExp, text: string): number | undefined {
  const m = text.match(re);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function extractFields(code: DocumentCode, req: ParseRequest): Record<string, number | string | boolean> {
  const provided = (req.fields ?? {}) as Record<string, number | string | boolean>;
  const text = (req.ocr_text ?? "").toUpperCase();
  const out: Record<string, number | string | boolean> = { ...provided };

  switch (code) {
    case "NOA": {
      out.line_15000_total_income ??= num(/LINE\s*15000[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      out.line_23600_net_income ??= num(/LINE\s*23600[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      const balanceOwing = num(/BALANCE\s+OWING[^\d-]*([\d,]+\.?\d*)/i, text);
      out.balance_owing ??= balanceOwing ?? 0;
      out.has_arrears ??= Boolean(
        /ARREARS|AMOUNT\s+OWING|UNPAID\s+BALANCE/i.test(text) ||
        (typeof out.balance_owing === "number" && out.balance_owing > 0),
      );
      break;
    }
    case "T1": {
      out.line_15000_total_income ??= num(/LINE\s*15000[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      out.line_23600_net_income ??= num(/LINE\s*23600[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      break;
    }
    case "T4": {
      out.box_14_employment_income ??= num(/BOX\s*14[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      break;
    }
    case "T2125": {
      out.part5_gross_income ??= num(/PART\s*5[^\d]*GROSS[^\d]*([\d,]+\.?\d*)/i, text)
        ?? num(/GROSS\s+(?:BUSINESS\s+)?INCOME[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      out.part5_net_income ??= num(/PART\s*5[^\d]*NET[^\d]*([\d,]+\.?\d*)/i, text)
        ?? num(/NET\s+(?:BUSINESS\s+)?INCOME[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      out.total_expenses ??= num(/TOTAL\s+EXPENSES[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      break;
    }
    case "BANK_STATEMENT": {
      out.total_deposits ??= num(/TOTAL\s+DEPOSITS[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      out.total_withdrawals ??= num(/TOTAL\s+WITHDRAWALS[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      break;
    }
    case "INVOICE": {
      out.amount_due ??= num(/AMOUNT\s+DUE[^\d]*([\d,]+\.?\d*)/i, text)
        ?? num(/TOTAL[^\d]*([\d,]+\.?\d*)/i, text) ?? 0;
      break;
    }
    default:
      break;
  }
  return out;
}

// --- Main handler ------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: ParseRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Identify + extract
  const code = identifyDocument(body);
  const fields = extractFields(code, body);
  const parsed: ParsedDoc = { document_code: code, fields };

  // 2. Persist the document record (if linked to an application)
  if (body.application_id && code !== "UNKNOWN") {
    await supabase.from("application_documents").insert({
      application_id: body.application_id,
      document_code: code,
      payload: fields,
    });
  }

  // 3. Variance & risk analysis
  const alerts: Array<{
    alert_code: string;
    severity: string;
    message: string;
    details: Record<string, unknown>;
  }> = [];

  // 3a. CRA arrears on NOA
  if (code === "NOA") {
    const balance = Number(fields.balance_owing ?? 0);
    if (fields.has_arrears === true || balance > 0) {
      alerts.push({
        alert_code: "CRA_ARREARS_DETECTED",
        severity: "CRITICAL",
        message: `CRA arrears detected on NOA (balance owing $${balance.toFixed(2)}). Potential Crown super-priority lien.`,
        details: { balance_owing: balance, source: "NOA-OCR" },
      });
    }
  }

  // 3b. Variance: compare new doc net income to existing NOA on file
  if (body.application_id && (code === "T2125" || code === "T1" || code === "T4")) {
    const { data: existingNoa } = await supabase
      .from("application_documents")
      .select("payload, tax_year, created_at")
      .eq("application_id", body.application_id)
      .eq("document_code", "NOA")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingNoa?.payload) {
      const noaNet = Number((existingNoa.payload as Record<string, unknown>).line_23600_net_income ?? 0);
      const newNet =
        code === "T2125" ? Number(fields.part5_net_income ?? 0)
        : code === "T4"  ? Number(fields.box_14_employment_income ?? 0)
        : Number(fields.line_23600_net_income ?? 0);
      const variance = newNet - noaNet;
      if (Math.abs(variance) > 0) {
        alerts.push({
          alert_code: "INCOME_VARIANCE_DETECTED",
          severity: Math.abs(variance) > 5000 ? "HIGH" : "WARN",
          message: `${code} net income $${newNet.toFixed(2)} diverges from NOA Line 23600 $${noaNet.toFixed(2)} (Δ $${variance.toFixed(2)}).`,
          details: { document_code: code, noa_net: noaNet, new_net: newNet, variance },
        });
      }
    }
  }

  // 4. Persist alerts
  let insertedAlerts: unknown[] = [];
  if (alerts.length > 0 && body.application_id) {
    const { data } = await supabase
      .from("compliance_alerts")
      .insert(alerts.map((a) => ({ ...a, application_id: body.application_id, document_code: code })))
      .select();
    insertedAlerts = data ?? [];
  }

  return new Response(
    JSON.stringify({ parsed, alerts: insertedAlerts, alert_count: alerts.length }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
