// gemini-proxy: Google Gemini proxy for document extraction + AI features.
// Accepts { prompt, text?, system?, model?, max_tokens? } — same request shape
// as ai-proxy — and forwards to Gemini's generateContent API. Callers pass
// OCR-extracted text only; this proxy never receives or forwards the
// original PDF/image.

import { guard, jsonResponse } from "../_shared/proxy.ts";

interface GeminiRequest {
  prompt: string;
  text?: string;
  system?: string;
  model?: string;
  max_tokens?: number;
}

const DEFAULT_MODEL = "gemini-2.5-flash";

Deno.serve(async (req) => {
  const g = await guard(req, "gemini-proxy", ["GEMINI_API_KEY"]);
  if (g.kind === "response") return g.response;
  const { origin } = g;

  let body: GeminiRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  if (!body.prompt || typeof body.prompt !== "string") {
    return jsonResponse({ error: "prompt_required" }, 400, origin);
  }

  const model = body.model ?? DEFAULT_MODEL;

  const parts: unknown[] = [];
  if (body.text) parts.push({ text: `Document text:\n${body.text}` });
  parts.push({ text: body.prompt });

  const requestBody: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: { maxOutputTokens: body.max_tokens ?? 2048 },
  };
  if (body.system) {
    requestBody.systemInstruction = { parts: [{ text: body.system }] };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")!,
        },
        body: JSON.stringify(requestBody),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return jsonResponse({ error: "gemini_error", status: res.status, detail: data }, 502, origin);
    }
    return jsonResponse({ ok: true, data }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: "upstream_failure", message: String(e) }, 502, origin);
  }
});
