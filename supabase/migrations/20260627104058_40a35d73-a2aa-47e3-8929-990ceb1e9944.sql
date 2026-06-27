
-- Allow demo (unauthenticated) usage of underwriting tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.underwriting_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO anon;
GRANT SELECT ON public.compliance_alerts TO anon;
GRANT SELECT ON public.document_registry TO anon;

DROP POLICY IF EXISTS "Authenticated users can view applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Authenticated users can insert applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Authenticated users can update applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Authenticated users can delete applications" ON public.underwriting_applications;

CREATE POLICY "Anyone can view applications" ON public.underwriting_applications FOR SELECT USING (true);
CREATE POLICY "Anyone can insert applications" ON public.underwriting_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update applications" ON public.underwriting_applications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete applications" ON public.underwriting_applications FOR DELETE USING (true);

DROP POLICY IF EXISTS "Authenticated can view application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Authenticated can insert application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Authenticated can update application documents" ON public.application_documents;
DROP POLICY IF EXISTS "Authenticated can delete application documents" ON public.application_documents;

CREATE POLICY "Anyone can view application documents" ON public.application_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert application documents" ON public.application_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update application documents" ON public.application_documents FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete application documents" ON public.application_documents FOR DELETE USING (true);

DROP POLICY IF EXISTS "Authenticated can view compliance alerts" ON public.compliance_alerts;
CREATE POLICY "Anyone can view compliance alerts" ON public.compliance_alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can view document registry" ON public.document_registry;
CREATE POLICY "Anyone can view document registry" ON public.document_registry FOR SELECT USING (true);
