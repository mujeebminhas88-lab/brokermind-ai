// ocr-proxy: Google Document AI proxy for raw OCR text extraction.
// Accepts { fileData (base64), mimeType, processor? } and returns
// { ok: true, text, pages }.
//
// Requires GOOGLE_DOCUMENT_AI_KEY plus (optionally) GOOGLE_DOCUMENT_AI_ENDPOINT
// which is the full processor URL, e.g.
// https://us-documentai.googleapis.com/v1/projects/PROJECT/locations/us/processors/PROCESSOR:process
// If not configured, the caller may pass `processor` in the request body.

import { guard, jsonResponse } from "../_shared/proxy.ts";

interface OcrRequest {
  fileData: string;
  mimeType?: string;
  processor?: string;
}

Deno.serve(async (req) => {
  const g = await guard(req, "ocr-proxy", ["GOOGLE_DOCUMENT_AI_KEY"]);
  if (g.kind === "response") return g.response;
  const { origin } = g;

  let body: OcrRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  if (!body.fileData) {
    return jsonResponse({ error: "fileData_required" }, 400, origin);
  }
  const endpoint = body.processor ?? Deno.env.get("GOOGLE_DOCUMENT_AI_ENDPOINT");
  if (!endpoint) {
    return jsonResponse(
      { error: "processor_not_configured", message: "Set GOOGLE_DOCUMENT_AI_ENDPOINT secret or pass `processor`." },
      503,
      origin,
    );
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${Deno.env.get("GOOGLE_DOCUMENT_AI_KEY")}`,
      },
      body: JSON.stringify({
        rawDocument: {
          content: body.fileData,
          mimeType: body.mimeType ?? "application/pdf",
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return jsonResponse({ error: "google_error", status: res.status, detail: data }, 502, origin);
    }
    const text: string = data?.document?.text ?? "";
    const pages: number = Array.isArray(data?.document?.pages) ? data.document.pages.length : 0;
    return jsonResponse({ ok: true, text, pages, raw: data }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: "upstream_failure", message: String(e) }, 502, origin);
  }
});
