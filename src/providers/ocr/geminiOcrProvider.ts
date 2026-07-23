/**
 * Gemini OCR provider — uses Gemini's multimodal input to perform OCR only
 * (verbatim text transcription of the uploaded file), producing plain text
 * for the AI provider stage to interpret next. Same OCRProvider contract as
 * GoogleDocumentAIProvider; the AI layer never knows which one ran.
 *
 * Exists so the two-stage pipeline (OCR -> AI, unchanged from Phase 1) works
 * without a GOOGLE_DOCUMENT_AI_KEY configured — e.g. while testing with only
 * GEMINI_API_KEY set. Reuses the gemini-proxy edge function (same Gemini
 * API, different prompt/system instruction) rather than a separate edge
 * function or secret. This is a distinct call from GeminiProvider
 * (src/providers/ai/geminiProvider.ts) in the AI stage — different prompt,
 * different response handling, no shared code — matching the
 * ocr/ vs ai/ folder independence the rest of the abstraction relies on.
 */
import { geminiProxy } from "@/lib/proxyClient";
import type { OCRProvider, OcrRequest, OcrResult } from "./types";

const OCR_MODEL = "gemini-flash-latest";

// Deliberately instructs Gemini to behave like a plain OCR engine, not an
// interpreter — this is what keeps the OCR and AI stages independent even
// though both stages happen to call the same underlying Gemini API.
const OCR_SYSTEM_PROMPT =
  "You are an OCR engine, not a document interpreter or analyst. " +
  "Transcribe the document's visible text exactly as it appears, verbatim, " +
  "in reading order. Do not summarize, interpret, correct, translate, or " +
  "extract fields — output only the raw transcribed text content, nothing " +
  "else. If the document has multiple pages, insert the exact marker " +
  '"---PAGE BREAK---" on its own line between pages (not before the first ' +
  "page or after the last).";

const OCR_INSTRUCTION_PROMPT =
  "Transcribe this document's full text verbatim, per the system instructions.";

const PAGE_BREAK_MARKER = "---PAGE BREAK---";

// Generous relative to the AI-stage default (2048) — a verbatim multi-page
// transcription is often longer than a structured JSON extraction of it.
const OCR_MAX_TOKENS = 8192;

interface GeminiPart {
  text?: unknown;
}

interface GeminiContent {
  parts?: unknown;
}

interface GeminiCandidate {
  content?: GeminiContent;
}

interface GeminiResponse {
  candidates?: unknown;
}

function extractTextBlock(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const candidates = (response as GeminiResponse).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = (candidates[0] as GeminiCandidate | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const textPart = parts.find(
    (p): p is { text: string } =>
      !!p && typeof p === "object" && typeof (p as GeminiPart).text === "string",
  );
  return textPart?.text ?? null;
}

export class GeminiOcrProvider implements OCRProvider {
  readonly id = "gemini" as const;

  async extractText(request: OcrRequest): Promise<OcrResult> {
    const response = await geminiProxy({
      prompt: OCR_INSTRUCTION_PROMPT,
      image_base64: request.fileData,
      image_mime: request.mimeType,
      system: OCR_SYSTEM_PROMPT,
      model: OCR_MODEL,
      max_tokens: OCR_MAX_TOKENS,
    });

    const raw = response.data;
    const text = extractTextBlock(raw) ?? "";
    const pageCount = text.length > 0 ? text.split(PAGE_BREAK_MARKER).length : 0;

    return {
      provider: this.id,
      text,
      pageCount,
      raw,
    };
  }
}
