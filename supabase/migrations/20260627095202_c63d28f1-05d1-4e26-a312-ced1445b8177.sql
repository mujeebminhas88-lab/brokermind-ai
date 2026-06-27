
-- 1. Extend underwriting_applications
DO $$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('Salaried', 'Self-Employed', 'Incorporated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('Draft', 'In Review', 'Ready for Review', 'Approved', 'Declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.underwriting_applications
  ADD COLUMN IF NOT EXISTS employment_type public.employment_type NOT NULL DEFAULT 'Salaried',
  ADD COLUMN IF NOT EXISTS review_status public.review_status NOT NULL DEFAULT 'Draft';

-- 2. Document registry
CREATE TABLE IF NOT EXISTS public.document_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.document_registry TO authenticated;
GRANT ALL ON public.document_registry TO service_role;

ALTER TABLE public.document_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view document registry"
  ON public.document_registry FOR SELECT TO authenticated USING (true);

-- 3. Application documents (linked records)
CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  document_code TEXT NOT NULL REFERENCES public.document_registry(code),
  tax_year INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_documents_app_idx ON public.application_documents(application_id);
CREATE INDEX IF NOT EXISTS application_documents_code_idx ON public.application_documents(document_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated;
GRANT ALL ON public.application_documents TO service_role;

ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view application documents"
  ON public.application_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert application documents"
  ON public.application_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update application documents"
  ON public.application_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete application documents"
  ON public.application_documents FOR DELETE TO authenticated USING (true);

-- 4. updated_at trigger fn (shared)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_document_registry_updated_at ON public.document_registry;
CREATE TRIGGER update_document_registry_updated_at
  BEFORE UPDATE ON public.document_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_application_documents_updated_at ON public.application_documents;
CREATE TRIGGER update_application_documents_updated_at
  BEFORE UPDATE ON public.application_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enforcement trigger: Incorporated => requires T2 to move to Ready for Review
CREATE OR REPLACE FUNCTION public.enforce_incorporated_requires_t2()
RETURNS TRIGGER AS $$
DECLARE has_t2 BOOLEAN;
BEGIN
  IF NEW.review_status = 'Ready for Review' AND NEW.employment_type = 'Incorporated' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.application_documents
      WHERE application_id = NEW.id AND document_code = 'T2'
    ) INTO has_t2;
    IF NOT has_t2 THEN
      RAISE EXCEPTION 'Incorporated applicants require a linked T2 document before being marked Ready for Review'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS enforce_incorporated_t2_trigger ON public.underwriting_applications;
CREATE TRIGGER enforce_incorporated_t2_trigger
  BEFORE INSERT OR UPDATE ON public.underwriting_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_incorporated_requires_t2();

-- 6. Seed registry
INSERT INTO public.document_registry (code, category, label, description, required_fields, validation_rules) VALUES
  ('T1', 'Core Returns', 'T1 General Income Tax Return', 'Personal income tax return',
    '["line_15000_total_income","line_23600_net_income","line_26000_taxable_income","tax_year"]'::jsonb,
    '[{"rule":"income_positive","field":"line_15000_total_income","op":">=","value":0}]'::jsonb),
  ('T2', 'Core Returns', 'T2 Corporation Income Tax Return', 'Corporate return — Schedule 1, 100, 125',
    '["corp_name","business_number","tax_year","schedule_100_retained_earnings","schedule_125_net_income","schedule_1_taxable_income"]'::jsonb,
    '[{"rule":"requires_schedules","fields":["schedule_1","schedule_100","schedule_125"]},{"rule":"flag_negative_retained_earnings","field":"schedule_100_retained_earnings","op":"<","value":0}]'::jsonb),
  ('T4', 'T4 Family', 'T4 Statement of Remuneration Paid', 'Employment income slip',
    '["employer_name","box_14_employment_income","box_22_income_tax_deducted","tax_year"]'::jsonb,
    '[{"rule":"reconcile_to_t1","field":"box_14_employment_income"}]'::jsonb),
  ('T4A', 'T4 Family', 'T4A Statement of Pension, Retirement, Annuity, Other Income', 'Self-employed/contract fees',
    '["payer_name","box_020_self_employed_commissions","box_048_fees_for_services","tax_year"]'::jsonb,
    '[]'::jsonb),
  ('T5', 'Investments', 'T5 Statement of Investment Income', 'Investment income slip',
    '["box_24_eligible_dividends","box_13_interest","tax_year"]'::jsonb, '[]'::jsonb),
  ('T2125', 'Core Returns', 'T2125 Statement of Business or Professional Activities', 'Sole-prop business — requires Part 1 (Business identification) and Part 5 (Net income before adjustments)',
    '["business_name","industry_code","part1_business_identification","part5_gross_income","part5_net_income","tax_year"]'::jsonb,
    '[{"rule":"requires_parts","fields":["part1_business_identification","part5_net_income"]}]'::jsonb),
  ('T5013', 'Core Returns', 'T5013 Statement of Partnership Income', 'Partnership return',
    '["partnership_account_number","box_104_limited_partner_business_income","box_106_partner_share","tax_year"]'::jsonb,
    '[]'::jsonb),
  ('NOA', 'Core Returns', 'CRA Notice of Assessment', 'CRA-issued assessment',
    '["tax_year","line_15000_total_income","line_23600_net_income","balance_owing","has_arrears"]'::jsonb,
    '[{"rule":"flag_arrears","field":"has_arrears","op":"=","value":true},{"rule":"flag_balance_owing","field":"balance_owing","op":">","value":0}]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  required_fields = EXCLUDED.required_fields,
  validation_rules = EXCLUDED.validation_rules;
