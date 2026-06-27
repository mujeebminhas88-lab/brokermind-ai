
CREATE TABLE IF NOT EXISTS public.compliance_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  document_code TEXT,
  alert_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'WARN',
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_alerts_app_idx ON public.compliance_alerts(application_id);
CREATE INDEX IF NOT EXISTS compliance_alerts_code_idx ON public.compliance_alerts(alert_code);

GRANT SELECT ON public.compliance_alerts TO authenticated;
GRANT ALL ON public.compliance_alerts TO service_role;

ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view compliance alerts"
  ON public.compliance_alerts FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_compliance_alerts_updated_at ON public.compliance_alerts;
CREATE TRIGGER update_compliance_alerts_updated_at
  BEFORE UPDATE ON public.compliance_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
