-- Extend renewals for full pipeline tracker
ALTER TABLE public.renewals
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS current_balance numeric,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

-- Broker settings (signature, licence, etc.) for communication templates.
CREATE TABLE IF NOT EXISTS public.broker_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_name text,
  broker_email text,
  licence_number text,
  brokerage_name text,
  phone text,
  signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_settings TO authenticated;
GRANT ALL ON public.broker_settings TO service_role;

ALTER TABLE public.broker_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own broker settings" ON public.broker_settings;
CREATE POLICY "Users manage own broker settings"
  ON public.broker_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER broker_settings_updated_at
  BEFORE UPDATE ON public.broker_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();