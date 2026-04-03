/**
 * Content safety filter for AI-generated text.
 * Filters out inappropriate content before display to a 9-year-old user.
 */

/**
 * Hebrew blocklist — words and patterns that should not appear in
 * AI-generated text shown to children. Kept minimal and focused on
 * clearly inappropriate content.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  // Violence
  /רצח/,
  /טרור/,
  /פצצ/,
  // Profanity (common Hebrew)
  /זונ[הת]/,
  /מזדיי/,
  /חר[אה]/,
  /כוס\s*אמ/,
  // Drugs
  /סמי?ם/,
  /קוקאין/,
  /הרואין/,
  // Sexual content
  /סקס/,
  /פורנו/,
];

/**
 * Check if text contains blocked content.
 * Returns true if the text is safe, false if it contains blocked patterns.
 */
export function isContentSafe(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Filter an array of strings, removing any that contain blocked content.
 */
export function filterUnsafeContent<T extends { text: string }>(
  items: T[],
): T[] {
  return items.filter((item) => isContentSafe(item.text));
}
