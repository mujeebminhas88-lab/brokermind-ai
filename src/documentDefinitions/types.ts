/**
 * Document Definition Registry — types.
 *
 * This registry owns ONLY ingestion configuration: upload constraints, OCR
 * strategy, and AI prompt/model settings. Field names, extraction, and
 * validation logic remain owned exclusively by documentRegistry.ts's
 * DocumentRegistry (DocumentKind -> RegistryEntry.fields/extract/validate).
 *
 * Splitting it this way means there is exactly one place that defines what
 * fields a document has (documentRegistry.ts) and exactly one place that
 * defines how to go get them from a raw upload (this registry) — no second,
 * competing schema for the same document kinds.
 *
 * provider fields below reference the canonical provider id types from
 * src/providers/*\/types.ts (Phase 1.5) rather than declaring their own —
 * one definition of "which providers exist" for the whole codebase.
 */
import type { DocumentKind } from "@/utils/documentRegistry";
import type { OcrProviderId } from "@/providers/ocr/types";
import type { AiProviderId } from "@/providers/ai/types";

export interface DocumentUploadConfig {
  acceptedMimeTypes: string[];
  multiPageSupported: boolean;
  maxPages?: number;
}

export interface DocumentOcrConfig {
  /** Descriptive: which OCR provider this document kind is configured to expect. The
   *  provider actually instantiated at runtime is chosen by getOCRProvider() (VITE_OCR_PROVIDER). */
  provider: OcrProviderId;
  /** Optional processor override, passed straight through to the active OCR provider. */
  processor?: string;
}

export interface DocumentAiConfig {
  /** Descriptive: which AI provider this document kind is configured to expect. The
   *  provider actually instantiated at runtime is chosen by getAIProvider() (VITE_AI_PROVIDER). */
  provider: AiProviderId;
  model?: string;
  maxTokens?: number;
  /** Appended to the shared base system prompt; use for free-form documents that need extra guidance. */
  systemPromptOverride?: string;
  /** The instruction the AI provider receives alongside the OCR text. A sensible default is used if omitted. */
  promptTemplate?: string;
}

export interface DocumentIngestionDefinition {
  kind: DocumentKind;
  /** Bumped whenever prompt/upload/OCR config changes for this kind; recorded in extraction telemetry. */
  version: string;
  upload: DocumentUploadConfig;
  ocr: DocumentOcrConfig;
  ai: DocumentAiConfig;
}
