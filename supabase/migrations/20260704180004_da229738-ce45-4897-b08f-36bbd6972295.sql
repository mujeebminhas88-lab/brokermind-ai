
-- Shared owner-injection trigger function (reuse existing set_user_id_default)

-- =========================
-- parsed_documents
-- =========================
CREATE TABLE public.parsed_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  document_code TEXT NOT NULL,
  source_path TEXT,
  parsed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parsed_documents_user_id ON public.parsed_documents(user_id);
CREATE INDEX idx_parsed_documents_application_id ON public.parsed_documents(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parsed_documents TO authenticated;
GRANT ALL ON public.parsed_documents TO service_role;
ALTER TABLE public.parsed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select parsed_documents" ON public.parsed_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert parsed_documents" ON public.parsed_documents
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (application_id IS NULL OR EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    ))
  );
CREATE POLICY "Owners update parsed_documents" ON public.parsed_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete parsed_documents" ON public.parsed_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- audit_logs
-- =========================
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_application_id ON public.audit_logs(application_id);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (application_id IS NULL OR EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    ))
  );
-- audit_logs are immutable: no update/delete policies (default deny)

-- =========================
-- compliance_flags
-- =========================
CREATE TABLE public.compliance_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'WARN',
  status TEXT NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compliance_flags_user_id ON public.compliance_flags(user_id);
CREATE INDEX idx_compliance_flags_application_id ON public.compliance_flags(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_flags TO authenticated;
GRANT ALL ON public.compliance_flags TO service_role;
ALTER TABLE public.compliance_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select compliance_flags" ON public.compliance_flags
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert compliance_flags" ON public.compliance_flags
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (application_id IS NULL OR EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    ))
  );
CREATE POLICY "Owners update compliance_flags" ON public.compliance_flags
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete compliance_flags" ON public.compliance_flags
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- conditions
-- =========================
CREATE TABLE public.conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conditions_user_id ON public.conditions(user_id);
CREATE INDEX idx_conditions_application_id ON public.conditions(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conditions TO authenticated;
GRANT ALL ON public.conditions TO service_role;
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select conditions" ON public.conditions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert conditions" ON public.conditions
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );
CREATE POLICY "Owners update conditions" ON public.conditions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete conditions" ON public.conditions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- renewals
-- =========================
CREATE TABLE public.renewals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  lender TEXT NOT NULL,
  maturity_date DATE,
  current_rate NUMERIC,
  renewal_status TEXT NOT NULL DEFAULT 'upcoming',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewals_user_id ON public.renewals(user_id);
CREATE INDEX idx_renewals_application_id ON public.renewals(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.renewals TO authenticated;
GRANT ALL ON public.renewals TO service_role;
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select renewals" ON public.renewals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert renewals" ON public.renewals
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (application_id IS NULL OR EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    ))
  );
CREATE POLICY "Owners update renewals" ON public.renewals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete renewals" ON public.renewals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- rate_holds
-- =========================
CREATE TABLE public.rate_holds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  lender TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  expiry_date DATE NOT NULL,
  product TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_holds_user_id ON public.rate_holds(user_id);
CREATE INDEX idx_rate_holds_application_id ON public.rate_holds(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_holds TO authenticated;
GRANT ALL ON public.rate_holds TO service_role;
ALTER TABLE public.rate_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select rate_holds" ON public.rate_holds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert rate_holds" ON public.rate_holds
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (application_id IS NULL OR EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    ))
  );
CREATE POLICY "Owners update rate_holds" ON public.rate_holds
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete rate_holds" ON public.rate_holds
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- communications_log
-- =========================
CREATE TABLE public.communications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.underwriting_applications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  subject TEXT,
  body TEXT,
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_communications_log_user_id ON public.communications_log(user_id);
CREATE INDEX idx_communications_log_application_id ON public.communications_log(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications_log TO authenticated;
GRANT ALL ON public.communications_log TO service_role;
ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select communications_log" ON public.communications_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert communications_log" ON public.communications_log
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (application_id IS NULL OR EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    ))
  );
CREATE POLICY "Owners update communications_log" ON public.communications_log
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete communications_log" ON public.communications_log
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- Triggers: auto-inject user_id & updated_at
-- =========================
CREATE TRIGGER set_parsed_documents_user_id BEFORE INSERT ON public.parsed_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();
CREATE TRIGGER set_audit_logs_user_id BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();
CREATE TRIGGER set_compliance_flags_user_id BEFORE INSERT ON public.compliance_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();
CREATE TRIGGER set_conditions_user_id BEFORE INSERT ON public.conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();
CREATE TRIGGER set_renewals_user_id BEFORE INSERT ON public.renewals
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();
CREATE TRIGGER set_rate_holds_user_id BEFORE INSERT ON public.rate_holds
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();
CREATE TRIGGER set_communications_log_user_id BEFORE INSERT ON public.communications_log
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();

CREATE TRIGGER update_parsed_documents_updated_at BEFORE UPDATE ON public.parsed_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compliance_flags_updated_at BEFORE UPDATE ON public.compliance_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conditions_updated_at BEFORE UPDATE ON public.conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_renewals_updated_at BEFORE UPDATE ON public.renewals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rate_holds_updated_at BEFORE UPDATE ON public.rate_holds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_communications_log_updated_at BEFORE UPDATE ON public.communications_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
