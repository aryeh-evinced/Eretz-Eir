import { NextRequest } from "next/server";
import { z } from "zod";
import {
  authenticateRequest,
  parseBody,
  successResponse,
  errorResponse,
} from "@/lib/api/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAI } from "@/lib/ai/provider";
import { HINT_SYSTEM_PROMPT, buildHintPrompt } from "@/lib/ai/prompts";
import { hintResponseSchema, parseAIResponse } from "@/lib/ai/schema";
import { isContentSafe } from "@/lib/ai/contentSafety";
import { getHint, getRandomWord } from "@/lib/game/fallbackWords";
import { sanitizeAnswer } from "@/lib/game/normalization";
import { logger } from "@/lib/observability/logger";
import type { HebrewLetter, Category } from "@/lib/types/game";

const hintRequestSchema = z.object({
  letter: z.string().length(1),
  category: z.string(),
  mode: z.enum(["hint", "fill"]),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, hintRequestSchema);
  if (body instanceof Response) return body;

  const { letter, category, mode } = body.data;
  const supabase = createAdminClient();

  // Try AI hint/fill
  const result = await callAI(
    [
      { role: "system", content: HINT_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildHintPrompt(letter as HebrewLetter, category as Category, mode),
      },
    ],
    supabase,
  );

  if (result) {
    const parsed = parseAIResponse(result.text, hintResponseSchema);
    if (parsed && isContentSafe(parsed.text)) {
      const sanitized = sanitizeAnswer(parsed.text);
      logger.info("hint: AI response used", { letter, category, mode, provider: result.provider });
      return successResponse({ text: sanitized, source: "ai" });
    }

    if (parsed && !isContentSafe(parsed.text)) {
      logger.warn("hint: AI response failed content safety filter", { letter, category, mode });
    }
  }

  // Fallback to word-list
  const text = mode === "fill" ? getRandomWord(letter, category) : getHint(letter, category);

  logger.info("hint: word-list fallback used", { letter, category, mode });
  return successResponse({ text, source: "word-list" });
}
