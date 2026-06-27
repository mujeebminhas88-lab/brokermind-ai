import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/**
 * Runtime-safe Supabase client for BrokerMindAI.
 *
 * Resolution order:
 * 1. Lovable Cloud runtime globals  (globalThis.SUPABASE_URL, globalThis.SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY)
 * 2. Vite build-time env           (import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * 3. Server / SSR env              (process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY)
 *
 * This single client is used by both the browser UI and the auth-attacher middleware.
 */

const globalUrl =
  (globalThis as typeof globalThis & { SUPABASE_URL?: string }).SUPABASE_URL ??
  (globalThis as typeof globalThis & { VITE_SUPABASE_URL?: string }).VITE_SUPABASE_URL;

const globalKey =
  (globalThis as typeof globalThis & { SUPABASE_PUBLISHABLE_KEY?: string }).SUPABASE_PUBLISHABLE_KEY ??
  (globalThis as typeof globalThis & { SUPABASE_ANON_KEY?: string }).SUPABASE_ANON_KEY ??
  (globalThis as typeof globalThis & { VITE_SUPABASE_PUBLISHABLE_KEY?: string }).VITE_SUPABASE_PUBLISHABLE_KEY ??
  (globalThis as typeof globalThis & { VITE_SUPABASE_ANON_KEY?: string }).VITE_SUPABASE_ANON_KEY;

const supabaseUrl =
  globalUrl ??
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined) ??
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined);

const supabaseAnonKey =
  globalKey ??
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (typeof process !== 'undefined' ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ??
  (typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : undefined) ??
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  // Avoid throwing at module-init (would crash SSR/prerender on Vercel).
  // Log loudly instead; runtime calls will surface a clearer error.
  // eslint-disable-next-line no-console
  console.error(
    '[BrokerMindAI] Supabase client misconfigured: missing URL or publishable key. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the Vercel project environment.'
  );
}


export const supabase = createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
