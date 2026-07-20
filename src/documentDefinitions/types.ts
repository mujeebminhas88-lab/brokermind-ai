/**
 * Document Definition Registry — types.
 *
 * This registry owns ONLY ingestion configuration: upload constraints, OCR
 * strategy, and Claude prompt/model settings. Field names, extraction, and
 * validation logic remain owned exclusively by documentRegistry.ts's
 * DocumentRegistry (DocumentKind -> RegistryEntry.fields/extract/validate).
 *
 * Splitting it this way means there is exactly one place that defines what
 * fields a document has (documentRegistry.ts) and exactly one place that
 * defines how to go get them from a raw upload (this registry) — no second,
 * competing schema for the same document kinds.
 */
import type { DocumentKind } from "@/utils/documentRegistry";

export type OcrProvider = "google-document-ai";
export type LlmProvider = "anthropic";

export interface DocumentUploadConfig {
  acceptedMimeTypes: string[];
  multiPageSupported: boolean;
  maxPages?: number;
}

export interface DocumentOcrConfig {
  provider: OcrProvider;
  /** Optional Document AI processor override, passed straight through to ocr-proxy. */
  processor?: string;
}

export interface DocumentClaudeConfig {
  provider: LlmProvider;
  model?: string;
  maxTokens?: number;
  /** Appended to the shared base system prompt; use for free-form documents that need extra guidance. */
  systemPromptOverride?: string;
  /** The instruction Claude receives alongside the OCR text. A sensible default is used if omitted. */
  promptTemplate?: string;
}

export interface DocumentIngestionDefinition {
  kind: DocumentKind;
  /** Bumped whenever prompt/upload/OCR config changes for this kind; recorded in extraction telemetry. */
  version: string;
  upload: DocumentUploadConfig;
  ocr: DocumentOcrConfig;
  claude: DocumentClaudeConfig;
}
