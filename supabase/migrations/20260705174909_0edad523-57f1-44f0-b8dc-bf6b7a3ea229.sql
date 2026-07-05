
-- Extend review_status enum
ALTER TYPE public.review_status ADD VALUE IF NOT EXISTS 'New';
ALTER TYPE public.review_status ADD VALUE IF NOT EXISTS 'Documents Requested';
ALTER TYPE public.review_status ADD VALUE IF NOT EXISTS 'Conditions Issued';
ALTER TYPE public.review_status ADD VALUE IF NOT EXISTS 'Funded';
ALTER TYPE public.review_status ADD VALUE IF NOT EXISTS 'Withdrawn';

-- Add new columns to underwriting_applications
ALTER TABLE public.underwriting_applications
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS loan_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deal_type text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS lender_name text,
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

-- file_notes table (append-only)
CREATE TABLE IF NOT EXISTS public.file_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  note_type text NOT NULL DEFAULT 'general' CHECK (note_type IN ('general','flag','lender_communication')),
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.file_notes TO authenticated;
GRANT ALL ON public.file_notes TO service_role;

ALTER TABLE public.file_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read notes on own applications" ON public.file_notes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = file_notes.application_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users insert notes on own applications" ON public.file_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = file_notes.application_id AND a.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_file_notes_application ON public.file_notes(application_id, created_at DESC);
