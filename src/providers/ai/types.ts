/**
 * AI (LLM extraction) provider abstraction.
 *
 * AiExtractionRequest.documentText is plain OCR output — this layer never
 * knows or cares which OCR provider produced it. The ingestion pipeline
 * depends only on these types and getAIProvider() (factory.ts); it never
 * imports a concrete provider class or references "Claude"/"Gemini"/etc.
 * by name.
 *
 * Two ingestion modes (VITE_INGESTION_MODE, read by documentIngestPipeline.ts):
 *   - "pipeline" (default): OCR provider runs first; only `documentText` is
 *     populated here. Cost-optimized (avoids sending raw files to the LLM)
 *     and provider-independent for OCR specifically.
 *   - "native": no separate OCR pass; `fileData`/`mimeType` are populated
 *     instead, for an AIProvider whose `supportsNativeDocument` is true.
 * A request populates documentText XOR fileData/mimeType, never both — each
 * concrete provider handles whichever it receives.
 */

export type AiProviderId =
  | "claude"
  | "gemini"
  | "openai"
  | "azure-openai"
  | "aws-bedrock"
  | "vertex-ai";

export interface AiExtractionRequest {
  /** OCR output text — populated in "pipeline" mode. Provider-agnostic, never a specific OCR provider's raw shape. */
  documentText?: string;
  /** Raw file contents (base64, no data: URL prefix) — populated in "native" mode instead of documentText. */
  fileData?: string;
  /** Required alongside fileData in "native" mode. */
  mimeType?: string;
  systemPrompt: string;
  instructionPrompt: string;
  model?: string;
  maxTokens?: number;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiExtractionResult {
  provider: AiProviderId;
  model: string | null;
  /** Normalized text output (e.g. Claude's content[0].text) — what responseValidator parses. */
  text: string | null;
  usage: AiUsage;
  /**
   * Rough, telemetry-only cost estimate for this call — not a billing
   * figure. Each provider computes this from its own pricing, since the
   * pipeline must never hardcode a specific provider's rates.
   */
  estimatedCost: number | null;
  /** The provider's raw response — telemetry only. */
  raw: unknown;
}

export interface AIProvider {
  readonly id: AiProviderId;
  /** True if this provider can extract directly from a raw document
   *  (fileData/mimeType) without a separate OCR pass — i.e. safe to select
   *  under VITE_INGESTION_MODE=native. False/unimplemented providers cause
   *  the pipeline to throw a clear error rather than silently falling back
   *  to pipeline mode. */
  readonly supportsNativeDocument: boolean;
  extract(request: AiExtractionRequest): Promise<AiExtractionResult>;
}
