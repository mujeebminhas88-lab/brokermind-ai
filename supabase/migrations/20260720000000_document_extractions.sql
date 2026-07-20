-- Extraction telemetry for the AI document ingestion pipeline (Phase 1).
--
-- Every OCR + Claude extraction — and, in the future, every replay — writes
-- exactly one immutable row here. Rows are never updated or deleted: a
-- replay creates a brand-new row sharing the same document_id, it never
-- overwrites the original. This is the data future Internal Tools
-- (raw OCR/Claude viewers, cost/latency dashboards, prompt-version
-- comparison, replay) and future usage/billing reporting both read from.
--
-- Scoped by firm_id (this app's existing workspace/organization concept),
-- per the billing requirement that usage belongs to the workspace, not the
-- individual user.

CREATE TABLE IF NOT EXISTS public.document_extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE SET NULL,

  -- Stable per-document identifier, generated client-side once per uploaded
  -- document and reused across any future replay of that same document —
  -- lets Internal Tools group an original extraction with its replays.
  document_id UUID NOT NULL,
  document_kind TEXT NOT NULL,

  -- Which DocumentDefinition (prompt/upload/OCR config) produced this
  -- extraction. Recorded so prompt changes can be compared/audited later.
  definition_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,

  ocr_provider TEXT,
  ocr_model TEXT,
  llm_provider TEXT,
  llm_model TEXT,

  raw_ocr_text TEXT,
  raw_claude_response JSONB,
  structured_json JSONB,
  validation_outcome JSONB NOT NULL DEFAULT '{}'::jsonb,

  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,

  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost NUMERIC,

  success BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,

  -- 'upload' (real OCR->Claude pipeline) | 'json-upload' (temporary
  -- developer/testing path, destined for Internal Tools) | 'replay'
  -- (reserved for a future phase — never implemented yet).
  source TEXT NOT NULL DEFAULT 'upload',
  is_replay BOOLEAN NOT NULL DEFAULT false,
  page_count INTEGER,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_extractions_firm_id ON public.document_extractions(firm_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_application_id ON public.document_extractions(application_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON public.document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_document_kind ON public.document_extractions(document_kind);
CREATE INDEX IF NOT EXISTS idx_document_extractions_created_at ON public.document_extractions(created_at DESC);

GRANT SELECT, INSERT ON public.document_extractions TO authenticated;
GRANT ALL ON public.document_extractions TO service_role;

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

-- Immutable telemetry: no UPDATE/DELETE policies (default deny), matching
-- the audit_logs convention already used in this schema.
CREATE POLICY "Firm members read document_extractions"
  ON public.document_extractions FOR SELECT TO authenticated
  USING (public.is_firm_member(firm_id));

CREATE POLICY "Firm members insert document_extractions"
  ON public.document_extractions FOR INSERT TO authenticated
  WITH CHECK (public.is_firm_member(firm_id));
