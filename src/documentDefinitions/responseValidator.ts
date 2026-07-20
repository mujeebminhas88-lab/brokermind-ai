/**
 * Response Validator — turns an AI provider's normalized text output into
 * the exact payload shape ingest() already accepts.
 *
 * Provider-agnostic by design: this file takes a plain string
 * (AiExtractionResult.text from src/providers/ai/types.ts), never a
 * provider-specific response envelope. Unwrapping a provider's raw
 * response shape (e.g. Claude's content[0].text) is that provider's job —
 * see src/providers/ai/claudeProvider.ts — so this file never needs to
 * change when a new AI provider is added.
 *
 * Two things happen here:
 *   1. Defensively strip markdown code fences, in case the model wraps
 *      its JSON despite being told not to.
 *   2. Allowlist the parsed object's keys against
 *      DocumentRegistry[kind].fields[].name — this is what guarantees the
 *      returned payload aligns exactly with what processDocument()'s
 *      extract() aliasing AND verificationStore's direct-by-name field
 *      read both expect, with no silent mismatches.
 *
 * Keys the model returns that aren't in DocumentRegistry[kind].fields are
 * dropped from the payload, not treated as a validation failure — an
 * extra field shouldn't fail an otherwise-good extraction. They're still
 * reported back via `unexpectedFields` purely for telemetry, so future
 * prompt tuning has visibility into what a given provider/prompt tends to
 * add that the registry doesn't ask for.
 */
import { DocumentRegistry, type DocumentKind } from "@/utils/documentRegistry";

export type ExtractionValidationResult =
  | { ok: true; payload: Record<string, unknown>; unexpectedFields: string[] }
  | { ok: false; error: string };

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function validateExtraction(kind: DocumentKind, text: string | null): ExtractionValidationResult {
  if (text == null) {
    return { ok: false, error: "No text content in AI provider response." };
  }

  const stripped = stripCodeFences(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false, error: "AI provider response was not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "AI provider response JSON was not an object." };
  }

  const entry = DocumentRegistry[kind];
  const allowedNames = entry.fields.map((f) => f.name);
  const raw = parsed as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const name of allowedNames) {
    if (name in raw) payload[name] = raw[name];
  }
  const unexpectedFields = Object.keys(raw).filter((k) => !allowedNames.includes(k));

  return { ok: true, payload, unexpectedFields };
}
