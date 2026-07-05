// Thin wrappers around the vault-backed edge function proxies.
// All third-party API calls go through these — never call Anthropic /
// Google Document AI / Flinks / Plaid from the browser directly.

import { supabase } from "@/supabase/client";

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message || `${fn} failed`);
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
