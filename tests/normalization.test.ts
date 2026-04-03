import { describe, it, expect } from "vitest";
import { sanitizeAnswer, fuzzyMatch } from "@/lib/game/normalization";

describe("sanitizeAnswer", () => {
  it("trims whitespace", () => {
    expect(sanitizeAnswer("  מצרים  ")).toBe("מצרים");
  });

  it("collapses internal whitespace", () => {
    expect(sanitizeAnswer("תל   אביב")).toBe("תל אביב");
  });

  it("removes control characters", () => {
    expect(sanitizeAnswer("מצרים\n\t")).toBe("מצרים");
  });

  it("removes niqqud", () => {
    expect(sanitizeAnswer("מִצְרַיִם")).toBe("מצרים");
  });

  it("removes quotes and geresh", () => {
    expect(sanitizeAnswer('צ׳ילה')).toBe("צילה");
  });

  it("removes JSON structural characters", () => {
    expect(sanitizeAnswer("{מצרים}")).toBe("מצרים");
  });

  it("enforces max length of 30 characters", () => {
    const longString = "א".repeat(50);
    expect(sanitizeAnswer(longString).length).toBeLessThanOrEqual(30);
  });
});

describe("fuzzyMatch", () => {
  it("matches identical strings", () => {
    expect(fuzzyMatch("ירושלים", "ירושלים")).toBe(true);
  });

  it("matches after niqqud removal", () => {
    expect(fuzzyMatch("מִצְרַיִם", "מצרים")).toBe(true);
  });

  it("matches strings within Levenshtein threshold", () => {
    expect(fuzzyMatch("ירושלים", "ירושליים")).toBe(true);
  });

  it("rejects clearly different strings", () => {
    expect(fuzzyMatch("מצרים", "ברזיל")).toBe(false);
  });

  it("matches short words within threshold 1", () => {
    expect(fuzzyMatch("כלב", "כלב")).toBe(true);
  });

  it("rejects short words beyond threshold 1", () => {
    expect(fuzzyMatch("כלב", "דוב")).toBe(false);
  });
});
