/**
 * AI Provider Factory — selects the active AI provider from configuration
 * (VITE_AI_PROVIDER), never hardcoded. Only "claude" is implemented today;
 * the rest are recognized so the type system and factory already know
 * about them, but selecting one throws a clear error rather than silently
 * doing nothing or falling back to Claude unexpectedly.
 *
 * VITE_ prefix note: this factory runs in the browser (it's called from
 * documentIngestPipeline.ts, which runs client-side), and Vite only
 * exposes env vars prefixed VITE_ to client code — an unprefixed
 * AI_PROVIDER would never reach this code. See docs/ARCHITECTURE.md.
 */
import type { AIProvider, AiProviderId } from "./types";
import { ClaudeProvider } from "./claudeProvider";

const DEFAULT_PROVIDER: AiProviderId = "claude";

const RECOGNIZED_FUTURE_PROVIDERS: AiProviderId[] = [
  "gemini",
  "openai",
  "azure-openai",
  "aws-bedrock",
  "vertex-ai",
];

let cached: AIProvider | undefined;

function readConfiguredProvider(): AiProviderId {
  const configured = (import.meta.env?.VITE_AI_PROVIDER as string | undefined)?.trim();
  return (configured as AiProviderId | undefined) || DEFAULT_PROVIDER;
}

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const id = readConfiguredProvider();

  if (id === "claude") {
    cached = new ClaudeProvider();
    return cached;
  }

  if (RECOGNIZED_FUTURE_PROVIDERS.includes(id)) {
    throw new Error(
      `AI provider "${id}" is a recognized future provider but is not implemented yet. ` +
        `Set VITE_AI_PROVIDER=claude or leave it unset.`,
    );
  }

  throw new Error(
    `Unknown VITE_AI_PROVIDER "${id}". Supported: claude. ` +
      `Recognized but not yet implemented: ${RECOGNIZED_FUTURE_PROVIDERS.join(", ")}.`,
  );
}

/** Test-only escape hatch — never called by production code paths. */
export function resetAIProviderCacheForTests(): void {
  cached = undefined;
}
