/**
 * Document Definition Registry — lookup.
 *
 * getIngestionDefinition() always returns a usable definition for any
 * DocumentKind, even one with no explicit override below — it falls back to
 * sensible defaults. This means enabling a new document kind for real AI
 * extraction never requires touching documentIngestPipeline.ts, the prompt
 * builder, or the response validator: add an entry here only when a kind
 * needs something different from the defaults (a specialized OCR
 * processor, a tighter page limit, a bespoke system prompt for free-form
 * text, etc).
 */
import type { DocumentKind } from "@/utils/documentRegistry";
import type { DocumentIngestionDefinition } from "./types";

const DEFAULT_UPLOAD: DocumentIngestionDefinition["upload"] = {
  acceptedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/tiff",
    "image/webp",
  ],
  multiPageSupported: true,
  maxPages: 10,
};

const DEFAULT_OCR: DocumentIngestionDefinition["ocr"] = {
  provider: "google-document-ai",
};

const DEFAULT_AI: DocumentIngestionDefinition["ai"] = {
  provider: "claude",
};

type Overrides = Partial<
  Record<
    DocumentKind,
    Partial<Omit<DocumentIngestionDefinition, "kind">>
  >
>;

/**
 * Per-kind overrides. NOA is listed explicitly as the reference
 * implementation; every other DocumentKind already defined in
 * documentRegistry.ts works out of the box via the defaults above.
 */
const overrides: Overrides = {
  NOA: {
    version: "1.0.0",
  },
};

export function getIngestionDefinition(kind: DocumentKind): DocumentIngestionDefinition {
  const o = overrides[kind];
  return {
    kind,
    version: o?.version ?? "1.0.0",
    upload: { ...DEFAULT_UPLOAD, ...o?.upload },
    ocr: { ...DEFAULT_OCR, ...o?.ocr },
    ai: { ...DEFAULT_AI, ...o?.ai },
  };
}
