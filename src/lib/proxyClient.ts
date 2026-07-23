// Thin wrappers around the vault-backed edge function proxies.
// All third-party API calls go through these — never call Anthropic /
// Google Document AI / Flinks / Plaid from the browser directly.

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";

// When an edge function returns a non-2xx status, supabase-js's `error` is a
// FunctionsHttpError whose .message is ALWAYS the generic literal string
// "Edge Function returned a non-2xx status code" -- the function's actual
// JSON body (our own {error, message, detail} shape from _shared/proxy.ts)
// is only reachable via error.context, which is the raw Response object
// (per the SDK's own doc comment: `await error.context.json()`). Without
// this, every real failure reason (bad API key, upstream rate limit,
// malformed request, provider outage) was being silently discarded and
// replaced with that one useless generic message in the UI.
async function readEdgeFunctionErrorBody(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const context = error.context;
  if (!context || typeof context.json !== "function") return null;
  try {
    const body = await context.clone().json();
    if (body && typeof body === "object") {
      const b = body as { message?: unknown; error?: unknown; detail?: unknown };
      const detail =
        b.detail && typeof b.detail === "object" ? JSON.stringify(b.detail) : b.detail;
      const reason = [b.message ?? b.error, detail].filter(Boolean).join(" — ");
      if (reason) return reason;
    }
  } catch {
    // Body wasn't JSON (or already consumed) -- fall through to the generic message.
  }
  return null;
}

async function invoke<T>(fn: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
  if (error) {
    const detail = await readEdgeFunctionErrorBody(error);
    throw new Error(detail ? `${fn}: ${detail}` : error.message || `${fn} failed`);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error: unknown }).error) {
    const d = data as { error: string; message?: string };
    throw new Error(d.message || d.error);
  }
  return data as T;
}

export interface AiExtractInput {
  prompt: string;
  text?: string;
  image_base64?: string;
  image_mime?: string;
  system?: string;
  model?: string;
  max_tokens?: number;
}

export const aiProxy = (input: AiExtractInput) =>
  invoke<{ ok: true; data: unknown }>("ai-proxy", input);

export const geminiProxy = (input: AiExtractInput) =>
  invoke<{ ok: true; data: unknown }>("gemini-proxy", input);

export const ocrProxy = (input: { fileData: string; mimeType?: string; processor?: string }) =>
  invoke<{ ok: true; text: string; pages: number; raw: unknown }>("ocr-proxy", input);

export const flinksProxy = (input: { path: string; method?: string; payload?: unknown; instance?: string }) =>
  invoke<{ ok: true; data: unknown }>("flinks-proxy", input);

export const plaidProxy = (input: { path: string; payload?: Record<string, unknown>; env?: string }) =>
  invoke<{ ok: true; data: unknown }>("plaid-proxy", input);

// Recommended two-step document extraction pipeline:
//   1. OCR via Google Document AI (cheap raw-text pass)
//   2. Structured field extraction via Claude on the extracted text
// Cuts Anthropic token cost ~60% vs sending raw PDFs to Claude.
export async function extractDocument(params: {
  fileData: string;
  mimeType: string;
  extractionPrompt: string;
  system?: string;
}) {
  const ocr = await ocrProxy({ fileData: params.fileData, mimeType: params.mimeType });
  const ai = await aiProxy({
    prompt: params.extractionPrompt,
    text: ocr.text,
    system: params.system,
  });
  return { ocr, ai };
}
