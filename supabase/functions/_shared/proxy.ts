// Shared helpers for API-key vault proxy edge functions.
// Handles CORS, auth extraction, and best-effort in-memory rate limiting.
//
// NOTE on rate limiting: this uses an in-memory Map, which is per-instance
// and resets on cold start. For production-grade limits, back this with a
// Postgres counter table or Redis.

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    ALLOWED_ORIGINS.includes("*") || (origin && ALLOWED_ORIGINS.includes(origin))
      ? origin ?? "*"
      : ALLOWED_ORIGINS[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Extract the caller's user id from the JWT in the Authorization header.
// Uses Supabase's auth endpoint (verify_jwt is disabled on these functions
// so we authenticate the caller explicitly).
export async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

// In-memory sliding window rate limiter — 100 calls/hour per (user, function).
const HOUR_MS = 60 * 60 * 1000;
const LIMIT = 100;
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string): { ok: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < HOUR_MS);
  if (arr.length >= LIMIT) {
    return { ok: false, remaining: 0, resetIn: HOUR_MS - (now - arr[0]) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, remaining: LIMIT - arr.length, resetIn: HOUR_MS };
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// Guard wrapper: CORS preflight + auth + rate limit + secret presence check.
export async function guard(
  req: Request,
  fnName: string,
  requiredSecrets: string[],
): Promise<
  | { kind: "response"; response: Response }
  | { kind: "ok"; userId: string; origin: string | null }
> {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return { kind: "response", response: new Response(null, { status: 204, headers: corsHeaders(origin) }) };
  }
  if (req.method !== "POST") {
    return { kind: "response", response: jsonResponse({ error: "method_not_allowed" }, 405, origin) };
  }
  const userId = await getUserId(req);
  if (!userId) {
    return { kind: "response", response: jsonResponse({ error: "unauthorized" }, 401, origin) };
  }
  const rl = checkRateLimit(`${fnName}:${userId}`);
  if (!rl.ok) {
    return {
      kind: "response",
      response: jsonResponse(
        { error: "rate_limited", retry_in_ms: rl.resetIn, limit: LIMIT, window: "1h" },
        429,
        origin,
      ),
    };
  }
  const missing = requiredSecrets.filter((k) => !Deno.env.get(k));
  if (missing.length) {
    return {
      kind: "response",
      response: jsonResponse(
        { error: "secret_missing", missing, message: "API key not configured in vault." },
        503,
        origin,
      ),
    };
  }
  const pending = requiredSecrets.filter((k) => Deno.env.get(k) === "PENDING");
  if (pending.length) {
    return {
      kind: "response",
      response: jsonResponse(
        {
          error: "secret_pending",
          pending,
          message:
            "API key placeholder is 'PENDING'. Set the real value in the secret vault to enable this proxy.",
        },
        503,
        origin,
      ),
    };
  }
  return { kind: "ok", userId, origin };
}
