import { describe, it, expect } from "vitest";
import { computeUniqueness } from "@/lib/game/uniqueness";
import type { Answer, Category } from "@/lib/types/game";

function makeAnswer(
  id: string,
  playerId: string,
  category: Category,
  answerText: string | null,
): Answer {
  return {
    id,
    roundId: "round-1",
    playerId,
    category,
    answerText,
    submittedAt: new Date().toISOString(),
    isValid: null,
    startsWithLetter: null,
    isRealWord: null,
    matchesCategory: null,
    aiExplanation: null,
    isUnique: null,
    helpUsed: "none",
    speedBonus: false,
    score: 0,
  };
}

describe("computeUniqueness", () => {
  it("returns empty map for no answers", () => {
    const result = computeUniqueness([]);
    expect(result.size).toBe(0);
  });

  it("single player — all answers are unique (no competitors)", () => {
    const answers = [
      makeAnswer("a1", "p1", "ארץ", "ישראל"),
      makeAnswer("a2", "p1", "עיר", "תל אביב"),
    ];
    const result = computeUniqueness([answers]);
    expect(result.get("a1")).toBe(true);
    expect(result.get("a2")).toBe(true);
  });

  it("null answer is never unique", () => {
    const p1 = [makeAnswer("a1", "p1", "ארץ", null)];
    const result = computeUniqueness([p1]);
    expect(result.get("a1")).toBe(false);
  });

  it("empty string answer is never unique", () => {
    const p1 = [makeAnswer("a1", "p1", "ארץ", "")];
    const result = computeUniqueness([p1]);
    expect(result.get("a1")).toBe(false);
  });

  it("two players with identical answers — both not unique", () => {
    const p1 = [makeAnswer("a1", "p1", "ארץ", "ישראל")];
    const p2 = [makeAnswer("a2", "p2", "ארץ", "ישראל")];
    const result = computeUniqueness([p1, p2]);
    expect(result.get("a1")).toBe(false);
    expect(result.get("a2")).toBe(false);
  });

  it("two players with different answers — both unique", () => {
    const p1 = [makeAnswer("a1", "p1", "ארץ", "ישראל")];
    const p2 = [makeAnswer("a2", "p2", "ארץ", "מצרים")];
    const result = computeUniqueness([p1, p2]);
    expect(result.get("a1")).toBe(true);
    expect(result.get("a2")).toBe(true);
  });

  it("fuzzy matching: near-identical answers are not unique", () => {
    // "ירושלים" vs "ירושליים" — Levenshtein 1, within threshold
    const p1 = [makeAnswer("a1", "p1", "עיר", "ירושלים")];
    const p2 = [makeAnswer("a2", "p2", "עיר", "ירושליים")];
    const result = computeUniqueness([p1, p2]);
    expect(result.get("a1")).toBe(false);
    expect(result.get("a2")).toBe(false);
  });

  it("answers in different categories are independent", () => {
    const p1 = [
      makeAnswer("a1", "p1", "ארץ", "ישראל"),
      makeAnswer("a2", "p1", "עיר", "חיפה"),
    ];
    const p2 = [
      makeAnswer("a3", "p2", "ארץ", "ישראל"), // same as p1 in ארץ
      makeAnswer("a4", "p2", "עיר", "באר שבע"), // different from p1 in עיר
    ];
    const result = computeUniqueness([p1, p2]);
    // ארץ: both said ישראל → not unique
    expect(result.get("a1")).toBe(false);
    expect(result.get("a3")).toBe(false);
    // עיר: different answers → both unique
    expect(result.get("a2")).toBe(true);
    expect(result.get("a4")).toBe(true);
  });

  it("three players: only one with unique answer", () => {
    const p1 = [makeAnswer("a1", "p1", "חי", "ארי")];
    const p2 = [makeAnswer("a2", "p2", "חי", "ארי")]; // same as p1
    const p3 = [makeAnswer("a3", "p3", "חי", "נמר")]; // unique
    const result = computeUniqueness([p1, p2, p3]);
    expect(result.get("a1")).toBe(false);
    expect(result.get("a2")).toBe(false);
    expect(result.get("a3")).toBe(true);
  });

  it("answers from the same player are not compared against each other", () => {
    // A player cannot have two answers in the same category in a real game,
    // but the function should not treat them as competing with each other.
    const p1 = [
      makeAnswer("a1", "p1", "ארץ", "ישראל"),
      makeAnswer("a2", "p1", "ארץ", "ישראל"),
    ];
    const result = computeUniqueness([p1]);
    // No other player provided answers — both should be unique.
    expect(result.get("a1")).toBe(true);
    expect(result.get("a2")).toBe(true);
  });
});
