import { describe, it, expect } from "vitest";
import {
  parseAIResponse,
  validationResponseSchema,
  hintResponseSchema,
  competitorResponseSchema,
} from "@/lib/ai/schema";
import { isContentSafe } from "@/lib/ai/contentSafety";

describe("parseAIResponse", () => {
  it("parses valid validation response", () => {
    const json = JSON.stringify({
      validations: [
        {
          category: "ארץ",
          text: "אנגליה",
          isValid: true,
          startsWithLetter: true,
          isRealWord: true,
          matchesCategory: true,
          explanation: "מדינה מוכרת",
        },
      ],
    });
    const result = parseAIResponse(json, validationResponseSchema);
    expect(result).not.toBeNull();
    expect(result!.validations).toHaveLength(1);
    expect(result!.validations[0].isValid).toBe(true);
  });

  it("parses response wrapped in markdown code fences", () => {
    const json = '```json\n{"validations": [{"category": "ארץ", "text": "אנגליה", "isValid": true, "startsWithLetter": true, "isRealWord": true, "matchesCategory": true, "explanation": "ok"}]}\n```';
    const result = parseAIResponse(json, validationResponseSchema);
    expect(result).not.toBeNull();
    expect(result!.validations[0].isValid).toBe(true);
  });

  it("returns null for invalid JSON", () => {
    expect(parseAIResponse("not json", validationResponseSchema)).toBeNull();
  });

  it("returns null for JSON that doesn't match schema", () => {
    expect(parseAIResponse('{"wrong": "shape"}', validationResponseSchema)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAIResponse("", validationResponseSchema)).toBeNull();
  });

  it("parses valid hint response", () => {
    const json = JSON.stringify({ text: "חיה שחיה בים..." });
    const result = parseAIResponse(json, hintResponseSchema);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("חיה שחיה בים...");
  });

  it("rejects hint response with empty text", () => {
    const json = JSON.stringify({ text: "" });
    const result = parseAIResponse(json, hintResponseSchema);
    expect(result).toBeNull();
  });

  it("parses valid competitor response", () => {
    const json = JSON.stringify({
      answers: [
        { category: "ארץ", text: "אנגליה" },
        { category: "עיר", text: "אשדוד" },
      ],
    });
    const result = parseAIResponse(json, competitorResponseSchema);
    expect(result).not.toBeNull();
    expect(result!.answers).toHaveLength(2);
  });
});

describe("contentSafety", () => {
  it("allows normal Hebrew answers", () => {
    expect(isContentSafe("אנגליה")).toBe(true);
    expect(isContentSafe("ירושלים")).toBe(true);
    expect(isContentSafe("חתול")).toBe(true);
    expect(isContentSafe("תל אביב")).toBe(true);
  });

  it("blocks inappropriate content", () => {
    expect(isContentSafe("רצח")).toBe(false);
    expect(isContentSafe("טרור")).toBe(false);
    expect(isContentSafe("סקס")).toBe(false);
  });

  it("allows safe words that share prefixes with blocked words", () => {
    // "ארץ" should be safe even though it contains some Hebrew chars
    expect(isContentSafe("ארץ")).toBe(true);
    expect(isContentSafe("סמך")).toBe(true);
  });
});
