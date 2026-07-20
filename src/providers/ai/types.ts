/**
 * AI (LLM extraction) provider abstraction.
 *
 * AiExtractionRequest.documentText is plain OCR output — this layer never
 * knows or cares which OCR provider produced it. The ingestion pipeline
 * depends only on these types and getAIProvider() (factory.ts); it never
 * imports a concrete provider class or references "Claude"/"Gemini"/etc.
 * by name.
 */

export type AiProviderId =
  | "claude"
  | "gemini"
  | "openai"
  | "azure-openai"
  | "aws-bedrock"
  | "vertex-ai";

export interface AiExtractionRequest {
  /** OCR output text — provider-agnostic, never a specific OCR provider's raw shape. */
  documentText: string;
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
  extract(request: AiExtractionRequest): Promise<AiExtractionResult>;
}
