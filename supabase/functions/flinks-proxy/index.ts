// flinks-proxy: Canadian bank data (Flinks) proxy.
// Accepts { path, method?, payload?, instance? } and forwards to the Flinks
// REST API, injecting FLINKS_CLIENT_ID from vault.
//
// Secrets:
//   FLINKS_CLIENT_ID       — customer id
//   FLINKS_INSTANCE        — instance subdomain (e.g. "toolbox-api")
//   FLINKS_BASE_URL        — optional override; defaults to sandbox

import { guard, jsonResponse } from "../_shared/proxy.ts";

interface FlinksRequest {
  path: string;
  method?: string;
  payload?: unknown;
  instance?: string;
}

Deno.serve(async (req) => {
  const g = await guard(req, "flinks-proxy", ["FLINKS_CLIENT_ID"]);
  if (g.kind === "response") return g.response;
  const { origin } = g;

  let body: FlinksRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  if (!body.path || !body.path.startsWith("/")) {
    return jsonResponse({ error: "path_required", message: "Provide a Flinks API path starting with '/'." }, 400, origin);
  }

  const clientId = Deno.env.get("FLINKS_CLIENT_ID")!;
  const instance = body.instance ?? Deno.env.get("FLINKS_INSTANCE") ?? "toolbox-api";
  const base = Deno.env.get("FLINKS_BASE_URL") ?? `https://${instance}.private.fin.ag/v3/${clientId}`;
  const url = `${base}${body.path}`;
  const method = (body.method ?? "POST").toUpperCase();

  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body.payload ?? {}),
    });
    const text = await res.text();
    const data = (() => { try { return JSON.parse(text); } catch { return text; } })();
    if (!res.ok) {
      return jsonResponse({ error: "flinks_error", status: res.status, detail: data }, 502, origin);
    }
    return jsonResponse({ ok: true, data }, 200, origin);
  } catch (e) {
    return jsonResponse({ error: "upstream_failure", message: String(e) }, 502, origin);
  }
});
