/**
 * Prompt Builder — generates Claude's system prompt and extraction
 * instruction directly from DocumentRegistry[kind].fields. There is no
 * per-document hand-written prompt text anywhere else in the codebase;
 * the field list is the single source of truth for both what gets
 * validated (documentRegistry.ts) and what Claude is told to return.
 *
 * Note: proxyClient.extractDocument() already injects the OCR text into
 * the Claude call itself (as a separate "Document text:\n..." content
 * block, via aiProxy's `text` param) — so the prompt built here is only
 * the instruction, not a template requiring manual OCR-text substitution.
 */
import { DocumentRegistry, type DocumentKind } from "@/utils/documentRegistry";
import { getIngestionDefinition } from "./registry";

const BASE_SYSTEM_PROMPT =
  "You are extracting structured data from a mortgage underwriting document " +
  "for BrokerMindAI. Read the provided document text and return ONLY a single " +
  "JSON object — no markdown code fences, no commentary, no explanation. If a " +
  "field is not present in the text, use null rather than guessing.";

const DEFAULT_EXTRACTION_INSTRUCTION =
  "Extract the fields described in the system prompt from the document text " +
  "provided above. Return a single JSON object and nothing else.";

function fieldTable(kind: DocumentKind): string {
  const entry = DocumentRegistry[kind];
  return entry.fields.map((f) => `- ${f.name} (${f.type}): ${f.label}`).join("\n");
}

export interface ExtractionPrompt {
  system: string;
  extractionPrompt: string;
}

export function buildExtractionPrompt(kind: DocumentKind): ExtractionPrompt {
  const entry = DocumentRegistry[kind];
  const def = getIngestionDefinition(kind);

  const system = [
    def.claude.systemPromptOverride ?? BASE_SYSTEM_PROMPT,
    "",
    `Document type: ${entry.label}`,
    "Return a JSON object with exactly these keys:",
    fieldTable(kind),
  ].join("\n");

  const extractionPrompt = def.claude.promptTemplate ?? DEFAULT_EXTRACTION_INSTRUCTION;

  return { system, extractionPrompt };
}
