// plaid-proxy: Plaid API proxy (secondary/fallback to Flinks).
// Accepts { path, payload, client_id?, env? } and forwards to Plaid,
// injecting PLAID_SECRET (and PLAID_CLIENT_ID) from vault.
//
// Secrets:
//   PLAID_SECRET     — required
//   PLAID_CLIENT_ID  — required
//   PLAID_ENV        — "sandbox" | "development" | "production" (default sandbox)

import { guard, jsonResponse } from "../_shared/proxy.ts";

interface PlaidRequest {
  path: string;
  payload?: Record<string, unknown>;
  env?: string;
}

const HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

Deno.serve(async (req) => {
  const g = await guard(req, "plaid-proxy", ["PLAID_SECRET"]);
  if (g.kind === "response") return g.response;
  const { origin } = g;

  let body: PlaidRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  if (!body.path || !body.path.startsWith("/")) {
    return jsonResponse({ error: "path_required" }, 400, origin);
  }

  const env = body.env ?? Deno.env.get("PLAID_ENV") ?? "sandbox";
  const host = HOSTS[env] ?? HOSTS.sandbox;
  const clientId = Deno.env.get("PLAID_CLIENT_ID");
  if (!clientId) {
    return jsonResponse(
      { error: "secret_missing", missing: ["PLAID_CLIENT_ID"], message: "Add PLAID_CLIENT_ID to the secret vault." },
      503,
      origin,
    );
  }

  try {
    const res = await fetch(`${host}${body.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(body.payload ?? {}),
        client_id: clientId,
        secret: Deno.env.get("PLAID_SECRET"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return jsonResponse({ error: "plaid_error", status: res.status, detail: data }, 502, origin);
    }
    return jsonResponse({ ok: true, data }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: "upstream_failure", message: String(e) }, 502, origin);
  }
});
