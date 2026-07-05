
-- Onboarding flag
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- White label branding
ALTER TABLE public.broker_settings
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sender_name TEXT;

-- Lender policies
CREATE TABLE IF NOT EXISTS public.lender_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_ltv_detached NUMERIC,
  max_ltv_condo NUMERIC,
  max_ltv_rural NUMERIC,
  min_beacon INTEGER,
  max_tds NUMERIC,
  max_gds NUMERIC,
  acceptable_income_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  eligible_provinces TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lender_policies TO authenticated;
GRANT ALL ON public.lender_policies TO service_role;

ALTER TABLE public.lender_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm members view lender policies"
  ON public.lender_policies FOR SELECT TO authenticated
  USING (public.is_firm_member(firm_id));

CREATE POLICY "firm members manage lender policies"
  ON public.lender_policies FOR ALL TO authenticated
  USING (public.is_firm_member(firm_id))
  WITH CHECK (public.is_firm_member(firm_id));

CREATE TRIGGER trg_lender_policies_updated
  BEFORE UPDATE ON public.lender_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Term sheets
CREATE TABLE IF NOT EXISTS public.term_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.lender_policies(id) ON DELETE SET NULL,
  policy_version INTEGER,
  borrower_name TEXT,
  property_address TEXT,
  loan_amount NUMERIC,
  rate NUMERIC,
  term_months INTEGER,
  fees NUMERIC,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  merge_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.term_sheets TO authenticated;
GRANT ALL ON public.term_sheets TO service_role;

ALTER TABLE public.term_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm members view term sheets"
  ON public.term_sheets FOR SELECT TO authenticated
  USING (public.is_firm_member(firm_id));

CREATE POLICY "firm members manage term sheets"
  ON public.term_sheets FOR ALL TO authenticated
  USING (public.is_firm_member(firm_id))
  WITH CHECK (public.is_firm_member(firm_id));

CREATE TRIGGER trg_term_sheets_updated
  BEFORE UPDATE ON public.term_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
