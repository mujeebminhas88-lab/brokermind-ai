import { createClient } from '@supabase/supabase-js';

/**
 * This supports:
 * - Lovable Cloud (global injection)
 * - Vercel / Vite (import.meta.env)
 * - Browser runtime safety
 */

const supabaseUrl =
  (globalThis as any)?.SUPABASE_URL ??
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  (globalThis as any)?.SUPABASE_PUBLISHABLE_KEY ??
  (globalThis as any)?.SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase client misconfigured: missing URL or publishable/anon key'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);