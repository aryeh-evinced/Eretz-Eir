import type { Category, HebrewLetter } from "@/lib/types/game";

/**
 * System prompt for answer validation.
 * Structured prompting: user answers are in a bounded JSON data section,
 * never inlined with instruction text (prompt injection mitigation).
 */
export const VALIDATION_SYSTEM_PROMPT = `You are a Hebrew word game judge. Your job is to determine whether each answer is valid for the given category and starting letter.

Rules:
- The answer must start with the specified Hebrew letter.
- The answer must genuinely belong to the specified category.
- Accept common alternate spellings in Hebrew.
- Accept answers with spaces (multi-word names are fine).
- Reject answers that belong to a different category.
- Reject nonsense, gibberish, or offensive content.
- This is a children's game — be lenient with minor spelling variations but strict on category correctness.

Categories:
- ארץ (country): a recognized sovereign state
- עיר (city): a recognized city or town
- חי (animal): a living animal species
- צומח (plant): a plant, tree, flower, or vegetable
- ילד (boy's name): a real Hebrew/common boy's name
- ילדה (girl's name): a real Hebrew/common girl's name
- מקצוע (profession): a recognized job or profession
- זמר/ת (singer): a known, real singer (first + last name or stage name)

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`;

/**
 * Build the user message for batch validation of a player's answers.
 * Answers are in a JSON data section to prevent prompt injection.
 */
export function buildValidationPrompt(
  letter: HebrewLetter,
  answers: { category: Category; text: string }[],
): string {
  const data = {
    letter,
    answers: answers.map((a) => ({
      category: a.category,
      text: a.text,
    })),
  };

  return `Validate these Hebrew game answers. The required starting letter is "${letter}".

DATA:
${JSON.stringify(data, null, 2)}

For each answer, respond with this JSON structure:
{
  "validations": [
    {
      "category": "<category>",
      "text": "<original text>",
      "isValid": true/false,
      "startsWithLetter": true/false,
      "isRealWord": true/false,
      "matchesCategory": true/false,
      "explanation": "<brief Hebrew explanation>"
    }
  ]
}`;
}

/**
 * System prompt for hint generation.
 */
export const HINT_SYSTEM_PROMPT = `You are a Hebrew word game helper for children. Generate a helpful hint for the given category and letter. The hint should be age-appropriate (for a 9-year-old) and not give away the full answer.

Respond ONLY with valid JSON: {"text": "<hint in Hebrew>"}`;

/**
 * Build hint request prompt.
 */
export function buildHintPrompt(
  letter: HebrewLetter,
  category: Category,
  mode: "hint" | "fill",
): string {
  if (mode === "fill") {
    return `Give a valid answer for category "${category}" starting with the letter "${letter}".
Respond with JSON: {"text": "<full answer in Hebrew>"}`;
  }

  return `Give a helpful hint for the category "${category}" with the letter "${letter}".
The hint should help a child think of a word but not give the full answer.
Example hint format: "חיה שחיה בים..." or "העיר הגדולה ב..."
Respond with JSON: {"text": "<hint in Hebrew>"}`;
}

/**
 * System prompt for competitor answer generation.
 */
export const COMPETITOR_SYSTEM_PROMPT = `You are generating answers for AI competitors in a Hebrew word game (ארץ-עיר). Generate realistic answers that a player might give. Some answers should be common/obvious, others more creative. All answers must be valid Hebrew words.

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`;

/**
 * Build competitor generation prompt.
 */
export function buildCompetitorPrompt(
  letter: HebrewLetter,
  categories: Category[],
  difficulty: "easy" | "medium" | "hard",
): string {
  const difficultyInstruction =
    difficulty === "easy"
      ? "Give common, well-known answers that a child would know."
      : difficulty === "medium"
        ? "Mix common answers with some less obvious ones."
        : "Give creative, less common but valid answers.";

  return `Generate one answer per category for the Hebrew letter "${letter}".
${difficultyInstruction}

Categories: ${JSON.stringify(categories)}

Respond with JSON:
{
  "answers": [
    {"category": "<category>", "text": "<answer in Hebrew>"}
  ]
}`;
}
