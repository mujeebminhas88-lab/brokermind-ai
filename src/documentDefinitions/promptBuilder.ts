/**
 * Prompt Builder — generates the AI provider's system prompt and
 * extraction instruction directly from DocumentRegistry[kind].fields.
 * There is no per-document hand-written prompt text anywhere else in the
 * codebase; the field list is the single source of truth for both what
 * gets validated (documentRegistry.ts) and what the AI provider is told
 * to return. This file has no knowledge of which AI provider is active —
 * it only produces plain strings, passed to whichever AIProvider
 * getAIProvider() resolves to.
 *
 * Note: AIProvider.extract() takes the OCR text as a separate
 * `documentText` field (see src/providers/ai/types.ts) — so the prompt
 * built here is only the instruction, not a template requiring manual
 * OCR-text substitution.
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
  return entry.fields
    .map((f) => {
      // `hint` is human-facing too (rendered in ComplianceIntakePanel) — kept short by
      // convention. `aiHint` is AI-extraction guidance only, never shown in the UI; it
      // can be as verbose as the extraction task needs. Both reach the prompt here.
      const guidance = [f.hint, f.aiHint].filter(Boolean).join(" — ");
      return `- ${f.name} (${f.type}): ${f.label}${guidance ? ` — ${guidance}` : ""}`;
    })
    .join("\n");
}

export interface ExtractionPrompt {
  system: string;
  extractionPrompt: string;
}

export function buildExtractionPrompt(kind: DocumentKind): ExtractionPrompt {
  const entry = DocumentRegistry[kind];
  const def = getIngestionDefinition(kind);

  const system = [
    def.ai.systemPromptOverride ?? BASE_SYSTEM_PROMPT,
    "",
    `Document type: ${entry.label}`,
    "Return a JSON object with exactly these keys:",
    fieldTable(kind),
  ].join("\n");

  const extractionPrompt = def.ai.promptTemplate ?? DEFAULT_EXTRACTION_INSTRUCTION;

  return { system, extractionPrompt };
}
