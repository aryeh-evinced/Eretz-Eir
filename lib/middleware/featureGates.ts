import type { ApiError } from "@/lib/types/api";

interface FeatureGateResult {
  allowed: boolean;
  error?: ApiError;
}

/**
 * Check if multiplayer features are enabled.
 */
export function checkMultiplayerEnabled(): FeatureGateResult {
  if (process.env.FEATURE_MULTIPLAYER_ENABLED !== "true") {
    return {
      allowed: false,
      error: {
        ok: false,
        error: {
          code: "MULTIPLAYER_DISABLED",
          message: "מצב מרובה משתתפים אינו זמין כרגע",
        },
      },
    };
  }
  return { allowed: true };
}

/**
 * Check if AI features are enabled.
 */
export function checkAIEnabled(): FeatureGateResult {
  if (process.env.FEATURE_AI_ENABLED !== "true") {
    return {
      allowed: false,
      error: {
        ok: false,
        error: {
          code: "AI_DISABLED",
          message: "תכונות AI אינן זמינות כרגע",
        },
      },
    };
  }
  return { allowed: true };
}
