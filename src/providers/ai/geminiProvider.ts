/**
 * Gemini (Google) AI provider — wraps the gemini-proxy edge function.
 *
 * Two request shapes, matching AiExtractionRequest's two modes (see
 * src/providers/ai/types.ts):
 *   - "pipeline" mode: receives OCR output text via `documentText`.
 *   - "native" mode (VITE_INGESTION_MODE=native): receives the raw file via
 *     `fileData`/`mimeType` instead — Gemini's multimodal input reads the
 *     document directly, no separate OCR pass. gemini-proxy forwards this
 *     as an inline_data part to Gemini's generateContent API.
 *
 * All Gemini-specific response-envelope unwrapping and cost estimation lives
 * in this file only — documentIngestPipeline.ts, responseValidator.ts, and
 * the factory all stay unaware of Gemini's response shape.
 */
import { geminiProxy } from "@/lib/proxyClient";
import type { AIProvider, AiExtractionRequest, AiExtractionResult, AiUsage } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";

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
  usageMetadata?: unknown;
  modelVersion?: unknown;
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

function extractUsage(response: unknown): AiUsage {
  if (!response || typeof response !== "object") return {};
  const usage = (response as GeminiResponse).usageMetadata;
  if (!usage || typeof usage !== "object") return {};
  const u = usage as Record<string, unknown>;
  return {
    inputTokens: typeof u.promptTokenCount === "number" ? u.promptTokenCount : undefined,
    outputTokens: typeof u.candidatesTokenCount === "number" ? u.candidatesTokenCount : undefined,
  };
}

// Rough, clearly-approximate per-token pricing for telemetry purposes only —
// not a billing figure. gemini-2.5-flash public per-token rates; update if
// Google's pricing changes. Deliberately owned by this provider, not the
// pipeline — a different provider would have entirely different rates.
const GEMINI_INPUT_COST_PER_TOKEN = 0.0000003;
const GEMINI_OUTPUT_COST_PER_TOKEN = 0.0000025;

function estimateCost(usage: AiUsage): number | null {
  if (usage.inputTokens == null && usage.outputTokens == null) return null;
  const inputCost = (usage.inputTokens ?? 0) * GEMINI_INPUT_COST_PER_TOKEN;
  const outputCost = (usage.outputTokens ?? 0) * GEMINI_OUTPUT_COST_PER_TOKEN;
  return Number((inputCost + outputCost).toFixed(6));
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly supportsNativeDocument = true;

  async extract(request: AiExtractionRequest): Promise<AiExtractionResult> {
    const requestedModel = request.model ?? DEFAULT_MODEL;

    const response = await geminiProxy({
      prompt: request.instructionPrompt,
      text: request.documentText,
      image_base64: request.fileData,
      image_mime: request.mimeType,
      system: request.systemPrompt,
      model: requestedModel,
      max_tokens: request.maxTokens,
    });

    const raw = response.data;
    const usage = extractUsage(raw);
    const model =
      typeof (raw as GeminiResponse)?.modelVersion === "string"
        ? ((raw as GeminiResponse).modelVersion as string)
        : requestedModel;

    return {
      provider: this.id,
      model,
      text: extractTextBlock(raw),
      usage,
      estimatedCost: estimateCost(usage),
      raw,
    };
  }
}
