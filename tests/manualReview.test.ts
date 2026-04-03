import { describe, it, expect } from "vitest";
import { shouldEnterManualReview } from "@/lib/game/manualReview";

describe("shouldEnterManualReview", () => {
  it("returns reviewing when AI validation succeeded", () => {
    const result = shouldEnterManualReview(false, false);
    expect(result.status).toBe("reviewing");
  });

  it("returns reviewing when AI validation succeeded in solo mode", () => {
    const result = shouldEnterManualReview(false, true);
    expect(result.status).toBe("reviewing");
  });

  it("returns manual_review when AI failed in multiplayer", () => {
    const result = shouldEnterManualReview(true, false);
    expect(result.status).toBe("manual_review");
  });

  it("returns reviewing when AI failed in solo mode (degradation)", () => {
    // Solo mode should never enter manual_review — no host to review
    const result = shouldEnterManualReview(true, true);
    expect(result.status).toBe("reviewing");
    expect(result.reason).toContain("solo");
  });
});
