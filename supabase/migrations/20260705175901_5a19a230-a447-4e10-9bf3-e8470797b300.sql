
ALTER TABLE public.broker_settings
  ADD COLUMN IF NOT EXISTS direct_phone text,
  ADD COLUMN IF NOT EXISTS mailing_address text,
  ADD COLUMN IF NOT EXISTS provinces text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  default_export text NOT NULL DEFAULT 'pdf' CHECK (default_export IN ('pdf','xlsx')),
  email_notifications boolean NOT NULL DEFAULT true,
  in_app_notifications boolean NOT NULL DEFAULT true,
  notif_rate_hold boolean NOT NULL DEFAULT true,
  notif_condition_overdue boolean NOT NULL DEFAULT true,
  notif_renewal_approaching boolean NOT NULL DEFAULT true,
  notif_new_flag boolean NOT NULL DEFAULT true,
  default_amortization int NOT NULL DEFAULT 25,
  default_term int NOT NULL DEFAULT 5,
  default_heating_cost numeric(10,2) NOT NULL DEFAULT 150,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.integration_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mindee','flinks','plaid')),
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('connected','not_configured','error')),
  key_last4 text,
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_status TO authenticated;
GRANT ALL ON public.integration_status TO service_role;

ALTER TABLE public.integration_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integration status" ON public.integration_status
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER integration_status_updated_at BEFORE UPDATE ON public.integration_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
