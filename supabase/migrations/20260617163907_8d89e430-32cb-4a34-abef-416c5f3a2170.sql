CREATE TABLE public.underwriting_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_number TEXT NOT NULL,
  taxpayer_name TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  line_15000_total_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_23600_net_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_owing NUMERIC(14,2) NOT NULL DEFAULT 0,
  has_arrears BOOLEAN NOT NULL DEFAULT false,
  aggregate_risk_score INTEGER NOT NULL DEFAULT 0,
  gds NUMERIC(6,2) NOT NULL DEFAULT 0,
  tds NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.underwriting_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.underwriting_applications TO authenticated;
GRANT ALL ON public.underwriting_applications TO service_role;

ALTER TABLE public.underwriting_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view underwriting log"
  ON public.underwriting_applications FOR SELECT
  USING (true);

CREATE POLICY "Public can insert underwriting log"
  ON public.underwriting_applications FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_uw_apps_created_at ON public.underwriting_applications (created_at DESC);
CREATE INDEX idx_uw_apps_taxpayer ON public.underwriting_applications (taxpayer_name);
CREATE INDEX idx_uw_apps_appnum ON public.underwriting_applications (application_number);