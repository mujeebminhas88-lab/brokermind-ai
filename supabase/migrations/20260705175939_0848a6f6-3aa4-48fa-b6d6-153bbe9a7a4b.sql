
DROP POLICY IF EXISTS "Users read own logos" ON storage.objects;
CREATE POLICY "Users read own logos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'brokerage-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users insert own logos" ON storage.objects;
CREATE POLICY "Users insert own logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brokerage-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own logos" ON storage.objects;
CREATE POLICY "Users update own logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'brokerage-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own logos" ON storage.objects;
CREATE POLICY "Users delete own logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'brokerage-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
