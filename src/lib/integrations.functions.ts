/**
 * Server functions used by the Integrations settings panel.
 *
 * Keys are NEVER stored in the database — they live only as environment
 * secrets. These functions inspect process.env server-side and return
 * "configured" plus a safe last-4 preview for the UI.
 */
import { createServerFn } from "@tanstack/react-start";
import process from "node:process";

type Provider = "mindee" | "flinks" | "plaid";

interface IntegrationCheck {
  provider: Provider;
  configured: boolean;
  last4: string | null;
  hint: string;
}

const PROVIDER_ENV: Record<Provider, string[]> = {
  // Mindee = document parsing. Google Document AI is what the app currently
  // uses for OCR, so we accept either.
  mindee: ["MINDEE_API_KEY", "GOOGLE_DOCUMENT_AI_KEY"],
  flinks: ["FLINKS_CLIENT_ID"],
  plaid: ["PLAID_SECRET"],
};

function tail(v: string | undefined): string | null {
  if (!v) return null;
  return v.length >= 4 ? v.slice(-4) : v;
}

export const checkIntegrations = createServerFn({ method: "GET" }).handler(async () => {
  const out: IntegrationCheck[] = [];
  for (const provider of Object.keys(PROVIDER_ENV) as Provider[]) {
    const envs = PROVIDER_ENV[provider];
    const foundEnv = envs.find((e) => !!process.env[e]);
    const value = foundEnv ? process.env[foundEnv] : undefined;
    out.push({
      provider,
      configured: !!value,
      last4: tail(value),
      hint: envs.join(" or "),
    });
  }
  return out;
});
