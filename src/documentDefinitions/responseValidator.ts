/**
 * Response Validator — turns Claude's raw Messages API response into the
 * exact payload shape ingest() already accepts.
 *
 * Three things happen here, none of which exist anywhere else in the
 * codebase today:
 *   1. Unwrap Claude's response envelope (the actual text lives at
 *      content[0].text, not at the top level).
 *   2. Defensively strip markdown code fences, in case the model wraps
 *      its JSON despite being told not to.
 *   3. Allowlist the parsed object's keys against
 *      DocumentRegistry[kind].fields[].name — this is what guarantees the
 *      returned payload aligns exactly with what processDocument()'s
 *      extract() aliasing AND verificationStore's direct-by-name field
 *      read both expect, with no silent mismatches.
 *
 * Keys Claude returns that aren't in DocumentRegistry[kind].fields are
 * dropped from the payload, not treated as a validation failure — a model
 * returning one extra field shouldn't fail an otherwise-good extraction.
 * They're still reported back via `unexpectedFields` purely for telemetry,
 * so future prompt tuning has visibility into what Claude tends to add
 * that the registry doesn't ask for.
 */
import { DocumentRegistry, type DocumentKind } from "@/utils/documentRegistry";

export type ExtractionValidationResult =
  | { ok: true; payload: Record<string, unknown>; unexpectedFields: string[] }
  | { ok: false; error: string };

interface AnthropicContentBlock {
  type?: unknown;
  text?: unknown;
}

interface AnthropicMessageResponse {
  content?: unknown;
}

function extractTextBlock(claudeApiResponse: unknown): string | null {
  if (!claudeApiResponse || typeof claudeApiResponse !== "object") return null;
  const content = (claudeApiResponse as AnthropicMessageResponse).content;
  if (!Array.isArray(content)) return null;
  const textBlock = content.find(
    (b): b is { type: string; text: string } =>
      !!b &&
      typeof b === "object" &&
      (b as AnthropicContentBlock).type === "text" &&
      typeof (b as AnthropicContentBlock).text === "string",
  );
  return textBlock?.text ?? null;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function validateExtraction(
  kind: DocumentKind,
  claudeApiResponse: unknown,
): ExtractionValidationResult {
  const text = extractTextBlock(claudeApiResponse);
  if (text == null) {
    return { ok: false, error: "No text content in Claude response." };
  }

  const stripped = stripCodeFences(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false, error: "Claude response was not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Claude response JSON was not an object." };
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
