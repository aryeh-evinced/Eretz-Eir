import Anthropic from "@anthropic-ai/sdk";
import type { AIMessage, AIProviderResult } from "./types";
import { logger } from "@/lib/observability/logger";

const MODEL = "claude-sonnet-4-20250514";
const TIMEOUT_MS = 10_000;
const MAX_TOKENS = 1024;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });
  }
  return client;
}

/**
 * Call Claude API with structured messages.
 * Returns parsed text response with usage metadata.
 */
export async function callClaude(messages: AIMessage[]): Promise<AIProviderResult> {
  const anthropic = getClient();
  const systemMessage = messages.find((m) => m.role === "system")?.content ?? "";
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => ({ role: "user" as const, content: m.content }));

  const start = Date.now();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemMessage,
    messages: userMessages,
  });

  const latencyMs = Date.now() - start;

  const text =
    response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("") || "";

  logger.info("claude: API call completed", {
    model: MODEL,
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return {
    text,
    provider: "claude",
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
