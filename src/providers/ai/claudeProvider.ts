/**
 * Claude (Anthropic) AI provider — wraps the existing ai-proxy edge
 * function. Behavior is identical to Phase 1: same request, same response
 * text, same cost estimate formula. This is purely an architectural
 * relocation behind the AIProvider interface — the Claude-specific
 * response-envelope unwrapping (content[0].text) now lives here instead of
 * in responseValidator.ts, which stays provider-agnostic.
 */
import { aiProxy } from "@/lib/proxyClient";
import type { AIProvider, AiExtractionRequest, AiExtractionResult, AiUsage } from "./types";

interface AnthropicContentBlock {
  type?: unknown;
  text?: unknown;
}

interface AnthropicMessageResponse {
  content?: unknown;
  model?: unknown;
  usage?: unknown;
}

function extractTextBlock(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const content = (response as AnthropicMessageResponse).content;
  if (!Array.isArray(content)) return null;
  const block = content.find(
    (b): b is { type: string; text: string } =>
      !!b &&
      typeof b === "object" &&
      (b as AnthropicContentBlock).type === "text" &&
      typeof (b as AnthropicContentBlock).text === "string",
  );
  return block?.text ?? null;
}

function extractUsage(response: unknown): AiUsage {
  if (!response || typeof response !== "object") return {};
  const usage = (response as AnthropicMessageResponse).usage;
  if (!usage || typeof usage !== "object") return {};
  const u = usage as Record<string, unknown>;
  return {
    inputTokens: typeof u.input_tokens === "number" ? u.input_tokens : undefined,
    outputTokens: typeof u.output_tokens === "number" ? u.output_tokens : undefined,
  };
}

// Rough, clearly-approximate per-token pricing for telemetry purposes only —
// not a billing figure. Same values as Phase 1; update if Anthropic's
// pricing changes. Deliberately owned by this provider, not the pipeline —
// a different provider would have entirely different rates.
const CLAUDE_INPUT_COST_PER_TOKEN = 0.000003;
const CLAUDE_OUTPUT_COST_PER_TOKEN = 0.000015;

function estimateCost(usage: AiUsage): number | null {
  if (usage.inputTokens == null && usage.outputTokens == null) return null;
  const inputCost = (usage.inputTokens ?? 0) * CLAUDE_INPUT_COST_PER_TOKEN;
  const outputCost = (usage.outputTokens ?? 0) * CLAUDE_OUTPUT_COST_PER_TOKEN;
  return Number((inputCost + outputCost).toFixed(6));
}

export class ClaudeProvider implements AIProvider {
  readonly id = "claude" as const;

  async extract(request: AiExtractionRequest): Promise<AiExtractionResult> {
    const response = await aiProxy({
      prompt: request.instructionPrompt,
      text: request.documentText,
      system: request.systemPrompt,
      model: request.model,
      max_tokens: request.maxTokens,
    });

    const raw = response.data;
    const model =
      typeof (raw as AnthropicMessageResponse)?.model === "string"
        ? ((raw as AnthropicMessageResponse).model as string)
        : (request.model ?? null);
    const usage = extractUsage(raw);

    return {
      provider: this.id,
      model,
      text: extractTextBlock(raw),
      usage,
      estimatedCost: estimateCost(usage),
      raw,
    };
  }
}
