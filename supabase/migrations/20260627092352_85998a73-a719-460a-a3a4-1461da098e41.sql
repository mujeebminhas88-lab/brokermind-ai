
DROP POLICY IF EXISTS "Public can insert underwriting log" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Public can view underwriting log" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Authenticated users can insert applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Authenticated users can update applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Authenticated users can view applications" ON public.underwriting_applications;
DROP POLICY IF EXISTS "Authenticated users can delete applications" ON public.underwriting_applications;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.underwriting_applications TO authenticated;
GRANT ALL ON public.underwriting_applications TO service_role;

CREATE POLICY "Authenticated users can view applications"
  ON public.underwriting_applications FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert applications"
  ON public.underwriting_applications FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update applications"
  ON public.underwriting_applications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete applications"
  ON public.underwriting_applications FOR DELETE
  TO authenticated USING (true);
