
-- 1. Roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Extend audit_logs with the required schema fields
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS table_name text,
  ADD COLUMN IF NOT EXISTS record_id uuid,
  ADD COLUMN IF NOT EXISTS old_value jsonb,
  ADD COLUMN IF NOT EXISTS new_value jsonb,
  ADD COLUMN IF NOT EXISTS ip_address text;

-- Backfill from legacy columns for any historical rows
UPDATE public.audit_logs
SET action_type = COALESCE(action_type, action),
    table_name = COALESCE(table_name, entity_type),
    record_id = COALESCE(record_id, entity_id)
WHERE action_type IS NULL OR table_name IS NULL OR record_id IS NULL;

-- Admin read-all policy (append-only remains: no UPDATE/DELETE policies exist)
DROP POLICY IF EXISTS "Admins select all audit_logs" ON public.audit_logs;
CREATE POLICY "Admins select all audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Generic audit trigger
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_record uuid;
  v_app uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record := (to_jsonb(OLD)->>'id')::uuid;
    v_user := COALESCE(auth.uid(), (to_jsonb(OLD)->>'user_id')::uuid);
    v_app := NULLIF(to_jsonb(OLD)->>'application_id','')::uuid;
    IF v_app IS NULL AND TG_TABLE_NAME = 'underwriting_applications' THEN
      v_app := v_record;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record := (to_jsonb(NEW)->>'id')::uuid;
    v_user := COALESCE(auth.uid(), (to_jsonb(NEW)->>'user_id')::uuid);
    v_app := NULLIF(to_jsonb(NEW)->>'application_id','')::uuid;
    IF v_app IS NULL AND TG_TABLE_NAME = 'underwriting_applications' THEN
      v_app := v_record;
    END IF;
  ELSE -- INSERT
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record := (to_jsonb(NEW)->>'id')::uuid;
    v_user := COALESCE(auth.uid(), (to_jsonb(NEW)->>'user_id')::uuid);
    v_app := NULLIF(to_jsonb(NEW)->>'application_id','')::uuid;
    IF v_app IS NULL AND TG_TABLE_NAME = 'underwriting_applications' THEN
      v_app := v_record;
    END IF;
  END IF;

  IF v_user IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_logs (
    user_id, application_id, action, entity_type, entity_id, details,
    action_type, table_name, record_id, old_value, new_value
  ) VALUES (
    v_user, v_app, TG_OP, TG_TABLE_NAME, v_record,
    jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME),
    TG_OP, TG_TABLE_NAME, v_record, v_old, v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Attach triggers to required tables
DROP TRIGGER IF EXISTS audit_underwriting_applications ON public.underwriting_applications;
CREATE TRIGGER audit_underwriting_applications
  AFTER INSERT OR UPDATE OR DELETE ON public.underwriting_applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_parsed_documents ON public.parsed_documents;
CREATE TRIGGER audit_parsed_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.parsed_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_compliance_flags ON public.compliance_flags;
CREATE TRIGGER audit_compliance_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.compliance_flags
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_conditions ON public.conditions;
CREATE TRIGGER audit_conditions
  AFTER INSERT OR UPDATE OR DELETE ON public.conditions
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
