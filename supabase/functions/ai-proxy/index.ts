// ai-proxy: Claude (Anthropic) proxy for document extraction + AI features.
// Accepts { prompt, text?, image_base64?, image_mime?, model?, max_tokens?, system? }
// and forwards to Anthropic's Messages API. Preferred flow: pass raw text
// from ocr-proxy (Google Document AI) rather than raw PDFs — cuts token
// cost ~60%.

import { guard, jsonResponse } from "../_shared/proxy.ts";

interface AiRequest {
  prompt: string;
  text?: string;
  image_base64?: string;
  image_mime?: string;
  system?: string;
  model?: string;
  max_tokens?: number;
}

Deno.serve(async (req) => {
  const g = await guard(req, "ai-proxy", ["ANTHROPIC_API_KEY"]);
  if (g.kind === "response") return g.response;
  const { origin } = g;

  let body: AiRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  if (!body.prompt || typeof body.prompt !== "string") {
    return jsonResponse({ error: "prompt_required" }, 400, origin);
  }

  const content: unknown[] = [];
  if (body.text) content.push({ type: "text", text: `Document text:\n${body.text}` });
  if (body.image_base64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: body.image_mime ?? "image/png",
        data: body.image_base64,
      },
    });
  }
  content.push({ type: "text", text: body.prompt });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: body.model ?? "claude-3-5-sonnet-20241022",
        max_tokens: body.max_tokens ?? 2048,
        system: body.system,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return jsonResponse({ error: "anthropic_error", status: res.status, detail: data }, 502, origin);
    }
    return jsonResponse({ ok: true, data }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: "upstream_failure", message: String(e) }, 502, origin);
  }
});
