import OpenAI from "openai";
import type { AIMessage, AIProviderResult } from "./types";
import { logger } from "@/lib/observability/logger";

const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 10_000;
const MAX_TOKENS = 1024;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey, timeout: TIMEOUT_MS });
  }
  return client;
}

/**
 * Call OpenAI API with structured messages.
 * Returns parsed text response with usage metadata.
 */
export async function callOpenAI(messages: AIMessage[]): Promise<AIProviderResult> {
  const openai = getClient();
  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const latencyMs = Date.now() - start;
  const text = response.choices[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;

  logger.info("openai: API call completed", {
    model: MODEL,
    latencyMs,
    inputTokens,
    outputTokens,
  });

  return {
    text,
    provider: "openai",
    latencyMs,
    inputTokens,
    outputTokens,
  };
}
