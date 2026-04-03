const MAX_ANSWER_LENGTH = 30;

/**
 * Sanitize and normalize a player's answer text.
 * Strips control characters, excessive whitespace, niqqud, and enforces max length.
 */
export function sanitizeAnswer(text: string): string {
  return (
    text
      .slice(0, MAX_ANSWER_LENGTH)
      // Remove control characters (newlines, tabs, etc.)
      .replace(/[\n\r\t\u0000-\u001F\u007F-\u009F]/g, "")
      // Remove JSON structural chars (prompt injection mitigation)
      .replace(/[{}[\]]/g, "")
      // Remove niqqud (Hebrew vowel marks)
      .replace(/[\u0591-\u05C7]/g, "")
      // Remove quotes and geresh
      .replace(/['"״׳]/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Normalize text for comparison (used in fuzzy matching and uniqueness detection).
 */
function normalize(text: string): string {
  return text
    .trim()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/\s+/g, " ")
    .replace(/['"״׳]/g, "");
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Fuzzy match two Hebrew strings.
 * Returns true if they are the same answer after normalization,
 * or within Levenshtein distance threshold.
 */
export function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return true;

  const threshold = Math.min(na.length, nb.length) <= 4 ? 1 : 2;
  return levenshtein(na, nb) <= threshold;
}
