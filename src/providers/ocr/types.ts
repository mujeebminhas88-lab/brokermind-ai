/**
 * OCR provider abstraction.
 *
 * The AI layer (src/providers/ai/*) never sees which OCR provider produced
 * a document's text — it only ever receives OcrResult.text as a plain
 * string. That's the whole point of this boundary: swapping Google
 * Document AI for Azure Document Intelligence, AWS Textract, Tesseract, or
 * a native PDF parser later should require touching only this folder, and
 * only the concrete provider file for that provider.
 */

export type OcrProviderId =
  | "google-document-ai"
  | "gemini"
  | "azure-document-intelligence"
  | "aws-textract"
  | "tesseract"
  | "native-pdf-parser";

export interface OcrRequest {
  /** Base64-encoded file contents (no data: URL prefix). */
  fileData: string;
  mimeType: string;
  /** Provider-specific processor/model hint (e.g. a Document AI processor ID). Optional. */
  processor?: string;
}

export interface OcrResult {
  provider: OcrProviderId;
  text: string;
  pageCount: number;
  /** The provider's raw response — telemetry only, never inspected by the AI layer. */
  raw: unknown;
}

export interface OCRProvider {
  readonly id: OcrProviderId;
  extractText(request: OcrRequest): Promise<OcrResult>;
}
