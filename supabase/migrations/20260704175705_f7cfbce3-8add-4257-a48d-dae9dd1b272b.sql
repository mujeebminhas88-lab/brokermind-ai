
-- 1. Purge pre-auth orphan data
DELETE FROM public.compliance_alerts;
DELETE FROM public.application_documents;
DELETE FROM public.underwriting_applications;

-- 2. Add user_id ownership column
ALTER TABLE public.underwriting_applications
  ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_underwriting_applications_user_id ON public.underwriting_applications(user_id);

-- 3. Drop permissive "Anyone can..." policies
DROP POLICY IF EXISTS "Anyone can view applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Anyone can insert applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Anyone can update applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Anyone can delete applications" ON public.underwriting_applications;

DROP POLICY IF EXISTS "Anyone can view application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Anyone can insert application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Anyone can update application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Anyone can delete application documents" ON public.application_documents;

DROP POLICY IF EXISTS "Anyone can view compliance alerts" ON public.compliance_alerts;

DROP POLICY IF EXISTS "Anyone can view document registry" ON public.document_registry;

-- 4. Revoke anon; grant authenticated + service_role
REVOKE ALL ON public.underwriting_applications FROM anon;
REVOKE ALL ON public.application_documents FROM anon;
REVOKE ALL ON public.compliance_alerts FROM anon;
REVOKE ALL ON public.document_registry FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.underwriting_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_alerts TO authenticated;
GRANT SELECT ON public.document_registry TO authenticated;

GRANT ALL ON public.underwriting_applications TO service_role;
GRANT ALL ON public.application_documents TO service_role;
GRANT ALL ON public.compliance_alerts TO service_role;
GRANT ALL ON public.document_registry TO service_role;

-- 5. Owner-scoped policies for underwriting_applications
CREATE POLICY "Owners select applications"
  ON public.underwriting_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners insert applications"
  ON public.underwriting_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners update applications"
  ON public.underwriting_applications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners delete applications"
  ON public.underwriting_applications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Application-scoped policies for application_documents (owner via parent application)
CREATE POLICY "Owners select application_documents"
  ON public.application_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Owners insert application_documents"
  ON public.application_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Owners update application_documents"
  ON public.application_documents FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Owners delete application_documents"
  ON public.application_documents FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = application_documents.application_id AND a.user_id = auth.uid()
  ));

-- 7. Application-scoped policies for compliance_alerts
CREATE POLICY "Owners select compliance_alerts"
  ON public.compliance_alerts FOR SELECT TO authenticated
  USING (
    application_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = compliance_alerts.application_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners insert compliance_alerts"
  ON public.compliance_alerts FOR INSERT TO authenticated
  WITH CHECK (
    application_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.underwriting_applications a
      WHERE a.id = compliance_alerts.application_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners update compliance_alerts"
  ON public.compliance_alerts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = compliance_alerts.application_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = compliance_alerts.application_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Owners delete compliance_alerts"
  ON public.compliance_alerts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.underwriting_applications a
    WHERE a.id = compliance_alerts.application_id AND a.user_id = auth.uid()
  ));

-- 8. Reference-data policy for document_registry (any signed-in user can read)
CREATE POLICY "Authenticated read document_registry"
  ON public.document_registry FOR SELECT TO authenticated
  USING (true);

-- 9. Hardening: prevent client from spoofing user_id on insert/update
CREATE OR REPLACE FUNCTION public.set_user_id_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_underwriting_applications_user_id
  BEFORE INSERT ON public.underwriting_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_default();
