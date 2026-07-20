/**
 * Document Ingest Pipeline — owns the entire upload -> ingest() flow.
 *
 * Responsibilities (all in this one file, by design — see docs/ARCHITECTURE.md):
 *   - Detect upload type (JSON test payload vs a real document file)
 *   - Handle JSON uploads (temporary developer/testing path — see note below)
 *   - Convert supported files to base64
 *   - Call proxyClient.extractDocument() (Google Document AI -> Claude)
 *   - Build prompts (via documentDefinitions/promptBuilder)
 *   - Parse + validate Claude's response, aligning field names exactly with
 *     DocumentRegistry[kind].fields[].name (via documentDefinitions/responseValidator)
 *   - Record extraction telemetry (document_extractions)
 *   - Return a payload ingest() already accepts
 *
 * The verification engine (documentRegistry.ts, verificationStore.ts,
 * DocumentVerificationModal, DossierGate) is never imported here and has no
 * awareness that OCR/Claude exist — this module's only contract with them is
 * the plain Record<string, unknown> payload it returns.
 *
 * TEMPORARY: the JSON-upload path (ingestFromJson) is a developer/testing
 * affordance, not a customer-facing feature. It is intentionally isolated
 * in its own function so it can later be gated behind the reserved Internal
 * Tools RBAC boundary without touching the real ingestion path. Do not wire
 * it up anywhere customers can reach it.
 */
import { DocumentRegistry, type DocumentKind } from "@/utils/documentRegistry";
import { extractDocument } from "@/lib/proxyClient";
import { supabase } from "@/supabase/client";
import { getIngestionDefinition } from "@/documentDefinitions/registry";
import { buildExtractionPrompt } from "@/documentDefinitions/promptBuilder";
import { validateExtraction } from "@/documentDefinitions/responseValidator";

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

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

function extractUsage(claudeApiResponse: unknown): AnthropicUsage {
  if (!claudeApiResponse || typeof claudeApiResponse !== "object") return {};
  const usage = (claudeApiResponse as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return {};
  const u = usage as Record<string, unknown>;
  return {
    input_tokens: typeof u.input_tokens === "number" ? u.input_tokens : undefined,
    output_tokens: typeof u.output_tokens === "number" ? u.output_tokens : undefined,
  };
}

// Rough, clearly-approximate per-token pricing for telemetry purposes only —
// not a billing figure. Update if the underlying model/provider pricing changes.
const CLAUDE_INPUT_COST_PER_TOKEN = 0.000003;
const CLAUDE_OUTPUT_COST_PER_TOKEN = 0.000015;

function estimateCost(usage: AnthropicUsage): number | null {
  if (usage.input_tokens == null && usage.output_tokens == null) return null;
  const inputCost = (usage.input_tokens ?? 0) * CLAUDE_INPUT_COST_PER_TOKEN;
  const outputCost = (usage.output_tokens ?? 0) * CLAUDE_OUTPUT_COST_PER_TOKEN;
  return Number((inputCost + outputCost).toFixed(6));
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
  rawClaudeResponse: unknown;
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
  source: "upload" | "json-upload";
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
      raw_claude_response: input.rawClaudeResponse as never,
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
 * payload — no OCR, no Claude. See the module-level note: this is destined
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
      rawClaudeResponse: null,
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
    rawClaudeResponse: null,
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

/** Real production path: PDF/image -> Google Document AI -> Claude -> validated JSON. */
async function ingestFromDocument(params: IngestUploadParams): Promise<IngestResult> {
  const startedAt = new Date();
  const documentId = params.documentId ?? crypto.randomUUID();
  const def = getIngestionDefinition(params.kind);

  if (!def.upload.acceptedMimeTypes.includes(params.file.type)) {
    return {
      ok: false,
      error: `Unsupported file type "${params.file.type || "unknown"}" for ${DocumentRegistry[params.kind].label}.`,
    };
  }

  const { system, extractionPrompt } = buildExtractionPrompt(params.kind);

  let rawOcrText: string | null = null;
  let rawClaudeResponse: unknown = null;
  let pageCount: number | null = null;

  try {
    const fileData = await fileToBase64(params.file);
    const { ocr, ai } = await extractDocument({
      fileData,
      mimeType: params.file.type,
      extractionPrompt,
      system,
    });
    rawOcrText = ocr.text;
    pageCount = ocr.pages ?? null;
    rawClaudeResponse = ai.data;

    const validation = validateExtraction(params.kind, ai.data);
    const usage = extractUsage(ai.data);
    const completedAt = new Date();

    await recordExtraction({
      firmId: params.firmId,
      applicationId: params.applicationId,
      documentId,
      kind: params.kind,
      definitionVersion: def.version,
      promptVersion: def.version,
      ocrProvider: def.ocr.provider,
      ocrModel: def.ocr.processor ?? null,
      llmProvider: def.claude.provider,
      llmModel: def.claude.model ?? null,
      rawOcrText,
      rawClaudeResponse,
      structuredJson: validation.ok ? validation.payload : null,
      validationOutcome: validation.ok ? { ok: true } : { ok: false, error: validation.error },
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      inputTokens: usage.input_tokens ?? null,
      outputTokens: usage.output_tokens ?? null,
      estimatedCost: estimateCost(usage),
      success: validation.ok,
      errorCode: validation.ok ? null : "VALIDATION_FAILED",
      errorMessage: validation.ok ? null : validation.error,
      source: "upload",
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
      ocrProvider: def.ocr.provider,
      ocrModel: def.ocr.processor ?? null,
      llmProvider: def.claude.provider,
      llmModel: def.claude.model ?? null,
      rawOcrText,
      rawClaudeResponse,
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
      source: "upload",
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
