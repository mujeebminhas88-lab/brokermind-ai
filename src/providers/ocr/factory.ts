/**
 * OCR Provider Factory — selects the active OCR provider from configuration
 * (VITE_OCR_PROVIDER), never hardcoded. Only "google-document-ai" is
 * implemented today; the rest are recognized so the type system and the
 * factory already know about them, but selecting one throws a clear error
 * rather than silently doing nothing.
 *
 * VITE_ prefix note: this factory runs in the browser (it's called from
 * documentIngestPipeline.ts, which runs client-side), and Vite only
 * exposes env vars prefixed VITE_ to client code — an unprefixed
 * OCR_PROVIDER would never reach this code. See docs/ARCHITECTURE.md.
 */
import type { OCRProvider, OcrProviderId } from "./types";
import { GoogleDocumentAIProvider } from "./googleDocumentAIProvider";

const DEFAULT_PROVIDER: OcrProviderId = "google-document-ai";

const RECOGNIZED_FUTURE_PROVIDERS: OcrProviderId[] = [
  "azure-document-intelligence",
  "aws-textract",
  "tesseract",
  "native-pdf-parser",
];

let cached: OCRProvider | undefined;

function readConfiguredProvider(): OcrProviderId {
  const configured = (import.meta.env?.VITE_OCR_PROVIDER as string | undefined)?.trim();
  return (configured as OcrProviderId | undefined) || DEFAULT_PROVIDER;
}

export function getOCRProvider(): OCRProvider {
  if (cached) return cached;

  const id = readConfiguredProvider();

  if (id === "google-document-ai") {
    cached = new GoogleDocumentAIProvider();
    return cached;
  }

  if (RECOGNIZED_FUTURE_PROVIDERS.includes(id)) {
    throw new Error(
      `OCR provider "${id}" is a recognized future provider but is not implemented yet. ` +
        `Set VITE_OCR_PROVIDER=google-document-ai or leave it unset.`,
    );
  }

  throw new Error(
    `Unknown VITE_OCR_PROVIDER "${id}". Supported: google-document-ai. ` +
      `Recognized but not yet implemented: ${RECOGNIZED_FUTURE_PROVIDERS.join(", ")}.`,
  );
}

/** Test-only escape hatch — never called by production code paths. */
export function resetOCRProviderCacheForTests(): void {
  cached = undefined;
}
