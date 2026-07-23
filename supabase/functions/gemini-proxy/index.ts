// gemini-proxy: Google Gemini proxy for document extraction + AI features.
// Accepts { prompt, text?, image_base64?, image_mime?, system?, model?,
// max_tokens? } — same request shape as ai-proxy. Two modes: pass `text`
// (OCR-extracted, pipeline ingestion mode) or `image_base64`/`image_mime`
// (raw file, native ingestion mode — see documentIngestPipeline.ts and
// src/providers/ai/types.ts for the mode split). Never both.

import { guard, jsonResponse } from "../_shared/proxy.ts";

interface GeminiRequest {
  prompt: string;
  text?: string;
  image_base64?: string;
  image_mime?: string;
  system?: string;
  model?: string;
  max_tokens?: number;
}

// Kept in sync with src/providers/ai/geminiProvider.ts's DEFAULT_MODEL.
// "gemini-flash-latest" is Google's maintained alias for the current
// flash-tier model — a dated string like "gemini-2.5-flash" is what caused
// this proxy to start returning 404s once Google stopped granting new API
// keys access to it ahead of its announced shutdown.
const DEFAULT_MODEL = "gemini-flash-latest";

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
  if (body.image_base64) {
    parts.push({
      inline_data: { mime_type: body.image_mime ?? "application/pdf", data: body.image_base64 },
    });
  } else if (body.text) {
    parts.push({ text: `Document text:\n${body.text}` });
  }
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
