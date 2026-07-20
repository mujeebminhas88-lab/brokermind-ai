/**
 * Google Document AI OCR provider — wraps the existing ocr-proxy edge
 * function. Behavior is identical to Phase 1; this is purely an
 * architectural relocation behind the OCRProvider interface.
 */
import { ocrProxy } from "@/lib/proxyClient";
import type { OCRProvider, OcrRequest, OcrResult } from "./types";

export class GoogleDocumentAIProvider implements OCRProvider {
  readonly id = "google-document-ai" as const;

  async extractText(request: OcrRequest): Promise<OcrResult> {
    const result = await ocrProxy({
      fileData: request.fileData,
      mimeType: request.mimeType,
      processor: request.processor,
    });
    return {
      provider: this.id,
      text: result.text,
      pageCount: result.pages,
      raw: result.raw,
    };
  }
}
