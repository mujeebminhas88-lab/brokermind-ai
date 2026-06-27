DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.compliance_alerts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.underwriting_applications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.compliance_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.underwriting_applications REPLICA IDENTITY FULL;