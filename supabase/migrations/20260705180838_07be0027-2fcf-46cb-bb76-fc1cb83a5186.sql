
SET session_replication_role = replica;

-- 1. FIRMS + MEMBERSHIP
CREATE TABLE IF NOT EXISTS public.firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Firm',
  plan TEXT NOT NULL DEFAULT 'solo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firms TO authenticated;
GRANT ALL ON public.firms TO service_role;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.firm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(firm_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firm_members TO authenticated;
GRANT ALL ON public.firm_members TO service_role;
ALTER TABLE public.firm_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_firm_member(_firm_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.firm_members WHERE firm_id = _firm_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.current_firm_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT firm_id FROM public.firm_members WHERE user_id = auth.uid() ORDER BY is_owner DESC, created_at ASC LIMIT 1
$$;

CREATE POLICY "Members view own firm" ON public.firms FOR SELECT TO authenticated USING (public.is_firm_member(id));
CREATE POLICY "Owners update firm" ON public.firms FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.firm_members WHERE firm_id = firms.id AND user_id = auth.uid() AND is_owner))
  WITH CHECK (EXISTS (SELECT 1 FROM public.firm_members WHERE firm_id = firms.id AND user_id = auth.uid() AND is_owner));
CREATE POLICY "Users create firms" ON public.firms FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Members view firm roster" ON public.firm_members FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));
CREATE POLICY "Owners manage roster" ON public.firm_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.firm_members m WHERE m.firm_id = firm_members.firm_id AND m.user_id = auth.uid() AND m.is_owner))
  WITH CHECK (EXISTS (SELECT 1 FROM public.firm_members m WHERE m.firm_id = firm_members.firm_id AND m.user_id = auth.uid() AND m.is_owner) OR user_id = auth.uid());
CREATE POLICY "Users join self" ON public.firm_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 2. BACKFILL firms per user
DO $$
DECLARE u RECORD; new_firm UUID;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.underwriting_applications
      UNION SELECT user_id FROM public.broker_settings
      UNION SELECT user_id FROM public.user_roles
      UNION SELECT user_id FROM public.user_preferences
    ) x WHERE user_id IS NOT NULL
  LOOP
    INSERT INTO public.firms (name) VALUES ('My Firm') RETURNING id INTO new_firm;
    INSERT INTO public.firm_members (firm_id, user_id, is_owner) VALUES (new_firm, u.user_id, true);
  END LOOP;
END $$;

-- 3. ADD firm_id
ALTER TABLE public.underwriting_applications ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.application_documents   ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs              ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL;
ALTER TABLE public.communications_log      ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.compliance_alerts       ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.compliance_flags        ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.conditions              ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.file_notes              ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.parsed_documents        ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.rate_holds              ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.renewals                ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.broker_settings         ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.user_preferences        ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles              ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.integration_status      ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE public.document_registry       ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE;

-- 4. Backfill firm_id
UPDATE public.underwriting_applications a SET firm_id = m.firm_id FROM public.firm_members m WHERE m.user_id = a.user_id AND a.firm_id IS NULL;
UPDATE public.audit_logs a SET firm_id = m.firm_id FROM public.firm_members m WHERE m.user_id = a.user_id AND a.firm_id IS NULL;
UPDATE public.broker_settings b SET firm_id = m.firm_id FROM public.firm_members m WHERE m.user_id = b.user_id AND b.firm_id IS NULL;
UPDATE public.user_preferences p SET firm_id = m.firm_id FROM public.firm_members m WHERE m.user_id = p.user_id AND p.firm_id IS NULL;
UPDATE public.user_roles r SET firm_id = m.firm_id FROM public.firm_members m WHERE m.user_id = r.user_id AND r.firm_id IS NULL;

UPDATE public.application_documents d SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE d.application_id = a.id AND d.firm_id IS NULL;
UPDATE public.communications_log c SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE c.application_id = a.id AND c.firm_id IS NULL;
UPDATE public.compliance_alerts c SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE c.application_id = a.id AND c.firm_id IS NULL;
UPDATE public.compliance_flags c SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE c.application_id = a.id AND c.firm_id IS NULL;
UPDATE public.conditions c SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE c.application_id = a.id AND c.firm_id IS NULL;
UPDATE public.file_notes n SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE n.application_id = a.id AND n.firm_id IS NULL;
UPDATE public.parsed_documents p SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE p.application_id = a.id AND p.firm_id IS NULL;
UPDATE public.rate_holds r SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE r.application_id = a.id AND r.firm_id IS NULL;
UPDATE public.renewals rn SET firm_id = a.firm_id FROM public.underwriting_applications a WHERE rn.application_id = a.id AND rn.firm_id IS NULL;

-- 5. Firm-scoped read policies
CREATE POLICY "Firm members read applications"    ON public.underwriting_applications FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read app documents"   ON public.application_documents FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read audit logs"      ON public.audit_logs FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read comms"           ON public.communications_log FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read compl alerts"    ON public.compliance_alerts FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read compl flags"     ON public.compliance_flags FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read conditions"      ON public.conditions FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read file notes"      ON public.file_notes FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read parsed docs"     ON public.parsed_documents FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read rate holds"      ON public.rate_holds FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));
CREATE POLICY "Firm members read renewals"        ON public.renewals FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_member(firm_id));

-- 6. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  severity TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, dedupe_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

CREATE TRIGGER firms_updated_at BEFORE UPDATE ON public.firms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SET session_replication_role = DEFAULT;
