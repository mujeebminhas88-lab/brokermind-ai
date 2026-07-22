/**
 * Document Ingest Pipeline — owns the entire upload -> ingest() flow.
 *
 * Responsibilities (all in this one file, by design — see docs/ARCHITECTURE.md):
 *   - Detect upload type (JSON test payload vs a real document file)
 *   - Handle JSON uploads (temporary developer/testing path — see note below)
 *   - Convert supported files to base64
 *   - Call the active OCR provider, then the active AI provider, via
 *     getOCRProvider()/getAIProvider() (Phase 1.5 provider abstraction) — or,
 *     in "native" ingestion mode, skip the OCR provider and let the AI
 *     provider read the raw file directly (see below)
 *   - Build prompts (via documentDefinitions/promptBuilder)
 *   - Parse + validate the AI provider's response, aligning field names
 *     exactly with DocumentRegistry[kind].fields[].name (via
 *     documentDefinitions/responseValidator)
 *   - Record extraction telemetry (document_extractions)
 *   - Return a payload ingest() already accepts
 *
 * This file depends only on the provider abstraction (src/providers/ai,
 * src/providers/ocr) — it never imports a concrete provider class or
 * references "Claude"/"Google Document AI"/etc. by name. Which concrete
 * providers actually run is decided entirely by getOCRProvider()/
 * getAIProvider(), which read VITE_OCR_PROVIDER/VITE_AI_PROVIDER.
 *
 * Ingestion mode (VITE_INGESTION_MODE, read by readIngestionMode() below):
 *   - "pipeline" (default): OCR provider -> AI provider, unchanged from
 *     Phase 1. Cost-optimized (raw files never reach the LLM) and the only
 *     mode that works when no AI provider supports native documents.
 *   - "native": no OCR provider call at all; the raw file goes straight to
 *     getAIProvider().extract() via fileData/mimeType. Requires the
 *     selected AI provider's supportsNativeDocument to be true (Claude and
 *     Gemini both are) — an explicit, actionable error is thrown otherwise,
 *     never a silent fallback. Exists so OCR (Google Document AI) is not a
 *     hard dependency for every AI provider — e.g. testing with only
 *     GEMINI_API_KEY configured, no GOOGLE_DOCUMENT_AI_KEY.
 *
 * The verification engine (documentRegistry.ts, verificationStore.ts,
 * DocumentVerificationModal, DossierGate) is never imported here and has no
 * awareness that OCR/AI providers or ingestion modes exist at all — this
 * module's only contract with them is the plain Record<string, unknown>
 * payload it returns, identical in either mode.
 *
 * TEMPORARY: the JSON-upload path (ingestFromJson) is a developer/testing
 * affordance, not a customer-facing feature. It is intentionally isolated
 * in its own function so it can later be gated behind the reserved Internal
 * Tools RBAC boundary without touching the real ingestion path. Do not wire
 * it up anywhere customers can reach it.
 */
import { DocumentRegistry, type DocumentKind } from "@/utils/documentRegistry";
import { supabase } from "@/supabase/client";
import { getIngestionDefinition } from "@/documentDefinitions/registry";
import { buildExtractionPrompt } from "@/documentDefinitions/promptBuilder";
import { validateExtraction } from "@/documentDefinitions/responseValidator";
import { getOCRProvider } from "@/providers/ocr/factory";
import { getAIProvider } from "@/providers/ai/factory";
import type { AiExtractionResult } from "@/providers/ai/types";

export type IngestResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

export interface IngestUploadParams {
  file: File;
  kind: DocumentKind;
  firmId: string | null;
  applicationId?: string | null;
  /** Reused across a future replay of the same document; a fresh one is generated if omitted. */
  documentId?: string;
}

const JSON_MIME_TYPES = new Set(["application/json"]);

function isJsonFile(file: File): boolean {
  return JSON_MIME_TYPES.has(file.type) || /\.json$/i.test(file.name);
}

// Filename-extension fallback, keyed to the same MIME types
// documentDefinitions/registry.ts declares as acceptable. Several browsers
// (particularly non-Apple ones) report an empty file.type for formats they
// don't natively recognize — HEIC/HEIF being the common real-world case —
// so a MIME-only check would wrongly reject a valid upload. Falls back to
// the file's extension whenever the reported MIME type isn't one of the
// document kind's accepted types.
const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

function resolveEffectiveMimeType(file: File, acceptedMimeTypes: string[]): string | null {
  if (acceptedMimeTypes.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const mapped = ext ? EXTENSION_TO_MIME[ext] : undefined;
  if (mapped && acceptedMimeTypes.includes(mapped)) return mapped;
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

type IngestionMode = "pipeline" | "native";

// VITE_ prefix required for the same reason as VITE_OCR_PROVIDER/
// VITE_AI_PROVIDER (see docs/ARCHITECTURE.md §9) — this file runs in the
// browser, and Vite only exposes VITE_-prefixed vars to client code.
function readIngestionMode(): IngestionMode {
  const configured = (import.meta.env?.VITE_INGESTION_MODE as string | undefined)?.trim();
  return configured === "native" ? "native" : "pipeline";
}

interface TelemetryInput {
  firmId: string | null;
  applicationId?: string | null;
  documentId: string;
  kind: DocumentKind;
  definitionVersion: string;
  promptVersion: string;
  ocrProvider: string | null;
  ocrModel: string | null;
  llmProvider: string | null;
  llmModel: string | null;
  rawOcrText: string | null;
  /** Maps to the document_extractions.raw_claude_response column (unchanged name — no migration needed). */
  rawAiResponse: unknown;
  structuredJson: Record<string, unknown> | null;
  validationOutcome: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  success: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  /** "native-upload" is a code-level addition only — document_extractions.source
   *  is an unconstrained text column, no migration required to add this value. */
  source: "upload" | "json-upload" | "native-upload";
  pageCount: number | null;
}

// Extraction telemetry is best-effort: a failure to record it must never
// affect the ingestion result the user actually sees.
async function recordExtraction(input: TelemetryInput): Promise<void> {
  if (!input.firmId) return;
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("document_extractions").insert({
      firm_id: input.firmId,
      application_id: input.applicationId ?? null,
      document_id: input.documentId,
      document_kind: input.kind,
      definition_version: input.definitionVersion,
      prompt_version: input.promptVersion,
      ocr_provider: input.ocrProvider,
      ocr_model: input.ocrModel,
      llm_provider: input.llmProvider,
      llm_model: input.llmModel,
      raw_ocr_text: input.rawOcrText,
      raw_claude_response: input.rawAiResponse as never,
      structured_json: input.structuredJson as never,
      validation_outcome: input.validationOutcome as never,
      started_at: input.startedAt,
      completed_at: input.completedAt,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      estimated_cost: input.estimatedCost,
      success: input.success,
      error_code: input.errorCode,
      error_message: input.errorMessage,
      source: input.source,
      is_replay: false,
      page_count: input.pageCount,
      created_by: userData.user?.id ?? null,
    });
  } catch (err) {
    console.warn("[documentIngestPipeline] telemetry write failed", err);
  }
}

/**
 * TEMPORARY developer/testing path. Reads a JSON file verbatim as the
 * payload — no OCR, no AI provider. See the module-level note: this is destined
 * to become part of the reserved Internal Tools feature set, gated by
 * Super Admin RBAC, not a customer-facing upload option.
 */
async function ingestFromJson(params: IngestUploadParams): Promise<IngestResult> {
  const startedAt = new Date();
  const documentId = params.documentId ?? crypto.randomUUID();

  let payload: Record<string, unknown>;
  try {
    const text = await params.file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON payload must be an object.");
    }
    payload = parsed as Record<string, unknown>;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON payload.";
    await recordExtraction({
      firmId: params.firmId,
      applicationId: params.applicationId,
      documentId,
      kind: params.kind,
      definitionVersion: getIngestionDefinition(params.kind).version,
      promptVersion: getIngestionDefinition(params.kind).version,
      ocrProvider: null,
      ocrModel: null,
      llmProvider: null,
      llmModel: null,
      rawOcrText: null,
      rawAiResponse: null,
      structuredJson: null,
      validationOutcome: { ok: false, error: message },
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt.getTime(),
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      success: false,
      errorCode: "INVALID_JSON",
      errorMessage: message,
      source: "json-upload",
      pageCount: null,
    });
    return { ok: false, error: message };
  }

  await recordExtraction({
    firmId: params.firmId,
    applicationId: params.applicationId,
    documentId,
    kind: params.kind,
    definitionVersion: getIngestionDefinition(params.kind).version,
    promptVersion: getIngestionDefinition(params.kind).version,
    ocrProvider: null,
    ocrModel: null,
    llmProvider: null,
    llmModel: null,
    rawOcrText: null,
    rawAiResponse: null,
    structuredJson: payload,
    validationOutcome: { ok: true },
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt.getTime(),
    inputTokens: null,
    outputTokens: null,
    estimatedCost: null,
    success: true,
    errorCode: null,
    errorMessage: null,
    source: "json-upload",
    pageCount: null,
  });

  return { ok: true, payload };
}

/**
 * Real production path: PDF/image -> validated JSON, via one of two modes
 * (see readIngestionMode() / the module header comment):
 *   - "pipeline": [OCR provider] -> [AI provider]
 *   - "native": [AI provider] reads the raw file directly, no OCR provider
 */
async function ingestFromDocument(params: IngestUploadParams): Promise<IngestResult> {
  const startedAt = new Date();
  const documentId = params.documentId ?? crypto.randomUUID();
  const def = getIngestionDefinition(params.kind);
  const mode = readIngestionMode();
  const source: TelemetryInput["source"] = mode === "native" ? "native-upload" : "upload";

  const effectiveMimeType = resolveEffectiveMimeType(params.file, def.upload.acceptedMimeTypes);
  if (!effectiveMimeType) {
    return {
      ok: false,
      error: `Unsupported file type "${params.file.type || "unknown"}" for ${DocumentRegistry[params.kind].label}.`,
    };
  }

  const { system, extractionPrompt } = buildExtractionPrompt(params.kind);

  let rawOcrText: string | null = null;
  let rawAiResponse: unknown = null;
  let pageCount: number | null = null;
  let ocrProviderId: string | null = null;
  let aiProviderId: string | null = null;
  let aiModel: string | null = null;

  try {
    const fileData = await fileToBase64(params.file);
    const aiProvider = getAIProvider();
    let aiResult: AiExtractionResult;

    if (mode === "native") {
      if (!aiProvider.supportsNativeDocument) {
        throw new Error(
          `AI provider "${aiProvider.id}" does not support native document mode ` +
            `(VITE_INGESTION_MODE=native). Set VITE_AI_PROVIDER to a provider with native ` +
            `document support (claude, gemini), or unset VITE_INGESTION_MODE / set it to "pipeline".`,
        );
      }
      aiResult = await aiProvider.extract({
        fileData,
        mimeType: effectiveMimeType,
        systemPrompt: system,
        instructionPrompt: extractionPrompt,
        model: def.ai.model,
        maxTokens: def.ai.maxTokens,
      });
    } else {
      const ocrResult = await getOCRProvider().extractText({
        fileData,
        mimeType: effectiveMimeType,
        processor: def.ocr.processor,
      });
      rawOcrText = ocrResult.text;
      pageCount = ocrResult.pageCount;
      ocrProviderId = ocrResult.provider;

      aiResult = await aiProvider.extract({
        documentText: ocrResult.text,
        systemPrompt: system,
        instructionPrompt: extractionPrompt,
        model: def.ai.model,
        maxTokens: def.ai.maxTokens,
      });
    }
    rawAiResponse = aiResult.raw;
    aiProviderId = aiResult.provider;
    aiModel = aiResult.model;

    const validation = validateExtraction(params.kind, aiResult.text);
    const completedAt = new Date();

    await recordExtraction({
      firmId: params.firmId,
      applicationId: params.applicationId,
      documentId,
      kind: params.kind,
      definitionVersion: def.version,
      promptVersion: def.version,
      ocrProvider: ocrProviderId,
      ocrModel: mode === "native" ? null : (def.ocr.processor ?? null),
      llmProvider: aiProviderId,
      llmModel: aiModel,
      rawOcrText,
      rawAiResponse,
      structuredJson: validation.ok ? validation.payload : null,
      validationOutcome: validation.ok
        ? { ok: true, unexpectedFields: validation.unexpectedFields }
        : { ok: false, error: validation.error },
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      inputTokens: aiResult.usage.inputTokens ?? null,
      outputTokens: aiResult.usage.outputTokens ?? null,
      estimatedCost: aiResult.estimatedCost,
      success: validation.ok,
      errorCode: validation.ok ? null : "VALIDATION_FAILED",
      errorMessage: validation.ok ? null : validation.error,
      source,
      pageCount,
    });

    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }
    return { ok: true, payload: validation.payload };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Document extraction failed.";
    const completedAt = new Date();
    await recordExtraction({
      firmId: params.firmId,
      applicationId: params.applicationId,
      documentId,
      kind: params.kind,
      definitionVersion: def.version,
      promptVersion: def.version,
      ocrProvider: ocrProviderId,
      ocrModel: mode === "native" ? null : (def.ocr.processor ?? null),
      llmProvider: aiProviderId,
      llmModel: aiModel,
      rawOcrText,
      rawAiResponse,
      structuredJson: null,
      validationOutcome: { ok: false, error: message },
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      success: false,
      errorCode: "PIPELINE_ERROR",
      errorMessage: message,
      source,
      pageCount,
    });
    return { ok: false, error: message };
  }
}

export async function ingestUpload(params: IngestUploadParams): Promise<IngestResult> {
  if (isJsonFile(params.file)) {
    return ingestFromJson(params);
  }
  return ingestFromDocument(params);
}
