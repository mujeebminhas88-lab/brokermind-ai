import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/**
 * BrokerMindAI Supabase client.
 *
 * Credential resolution (strict order, per architecture spec):
 *   1. Lovable Cloud runtime globals  — globalThis.SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
 *      (also honors SUPABASE_ANON_KEY + VITE_* mirrors that Lovable injects)
 *   2. Vite build-time env            — import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *      (also honors VITE_SUPABASE_PUBLISHABLE_KEY which Lovable provisions on Vercel)
 *   3. SSR/Node env                   — process.env.SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
 *
 * Missing credentials log loudly at module init and THROW on first runtime use of the
 * client (so SSR/prerender does not crash, but real API calls fail with a clear message).
 * Never resolves a service-role key on the client.
 */

type GlobalLike = typeof globalThis & {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

const g = globalThis as GlobalLike;

const supabaseUrl =
  g.SUPABASE_URL ??
  g.VITE_SUPABASE_URL ??
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined) ??
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined);

const supabaseAnonKey =
  g.SUPABASE_PUBLISHABLE_KEY ??
  g.SUPABASE_ANON_KEY ??
  g.VITE_SUPABASE_PUBLISHABLE_KEY ??
  g.VITE_SUPABASE_ANON_KEY ??
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (typeof process !== 'undefined' ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ??
  (typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : undefined);

const MISSING_MSG =
  '[BrokerMindAI] Supabase credentials missing. Expected globalThis.SUPABASE_URL + ' +
  'SUPABASE_PUBLISHABLE_KEY (Lovable runtime) or VITE_SUPABASE_URL + ' +
  'VITE_SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY (Vite env). ' +
  'Configure these in your Vercel project environment variables.';

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(MISSING_MSG);
}

// Build a real client when creds exist, otherwise a proxy that throws on first use.
// This keeps SSR/prerender alive (no module-init throw) while still surfacing a clear error.
function makeThrowingProxy(): ReturnType<typeof createClient<Database>> {
  return new Proxy({} as ReturnType<typeof createClient<Database>>, {
    get() {
      throw new Error(MISSING_MSG);
    },
  });
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : makeThrowingProxy();
