import { z } from "zod";
import { sanitizeAnswer } from "@/lib/game/normalization";
import type { Category } from "@/lib/types/game";

// 4 uppercase Hebrew letters (U+05D0–U+05EA) or digits
export const roomCodeSchema = z
  .string()
  .regex(/^[\u05D0-\u05EA\d]{4}$/, "קוד חדר חייב להכיל 4 תווים (אותיות עבריות או ספרות)");

// Answer text — max 30 chars, sanitized via sanitizeAnswer
export const answerTextSchema = z
  .string()
  .max(30, "תשובה ארוכה מדי")
  .transform((val) => sanitizeAnswer(val));

// Category must be one of the allowed Category values
const ALLOWED_CATEGORIES: [Category, ...Category[]] = [
  "ארץ",
  "עיר",
  "חי",
  "צומח",
  "ילד",
  "ילדה",
  "מקצוע",
  "זמר/ת",
];

export const categorySchema = z.enum(ALLOWED_CATEGORIES);

// Game settings object
export const gameSettingsSchema = z.object({
  mode: z.enum(["solo", "multiplayer"]),
  categoryMode: z.enum(["fixed", "custom", "random"]),
  timerSeconds: z.number().min(30).max(300),
  helpsPerRound: z.number().min(0).max(5),
});

// Submit answers payload
export const submitAnswersSchema = z.object({
  roundId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        category: categorySchema,
        text: answerTextSchema,
      }),
    )
    .min(1)
    .max(8),
});
