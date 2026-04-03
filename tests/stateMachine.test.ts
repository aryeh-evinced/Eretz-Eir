import { describe, it, expect } from "vitest";
import {
  transitionGame,
  transitionRound,
  transition,
} from "@/lib/game/stateMachine";
import type { GameStatus, RoundStatus } from "@/lib/types/game";

describe("transitionGame", () => {
  it("waiting -> playing via start_game", () => {
    expect(transitionGame("waiting", "start_game")).toBe("playing");
  });

  it("playing -> finished via finish_game", () => {
    expect(transitionGame("playing", "finish_game")).toBe("finished");
  });

  it("throws on illegal transition: finished cannot start_game", () => {
    expect(() => transitionGame("finished", "start_game")).toThrow(
      /Illegal game transition/,
    );
  });

  it("throws on illegal transition: waiting cannot finish_game", () => {
    expect(() => transitionGame("waiting", "finish_game")).toThrow(
      /Illegal game transition/,
    );
  });

  it("throws on illegal transition: finished cannot finish_game", () => {
    expect(() => transitionGame("finished", "finish_game")).toThrow(
      /Illegal game transition/,
    );
  });
});

describe("transitionRound", () => {
  it("playing -> playing via end_round_timer (no-op status change)", () => {
    expect(transitionRound("playing", "end_round_timer")).toBe("playing");
  });

  it("playing -> playing via end_round_all_done (no-op status change)", () => {
    expect(transitionRound("playing", "end_round_all_done")).toBe("playing");
  });

  it("playing -> reviewing via start_review", () => {
    expect(transitionRound("playing", "start_review")).toBe("reviewing");
  });

  it("playing -> manual_review via start_review with manualReview option", () => {
    expect(transitionRound("playing", "start_review", { manualReview: true })).toBe(
      "manual_review",
    );
  });

  it("reviewing -> completed via complete_review", () => {
    expect(transitionRound("reviewing", "complete_review")).toBe("completed");
  });

  it("manual_review -> completed via complete_review", () => {
    expect(transitionRound("manual_review", "complete_review")).toBe("completed");
  });

  it("throws on illegal transition: completed cannot complete_review again", () => {
    expect(() => transitionRound("completed", "complete_review")).toThrow(
      /Illegal round transition/,
    );
  });

  it("throws on illegal transition: reviewing cannot end_round_timer", () => {
    expect(() => transitionRound("reviewing", "end_round_timer")).toThrow(
      /Illegal round transition/,
    );
  });

  it("throws on illegal transition: completed cannot start_review", () => {
    expect(() => transitionRound("completed", "start_review")).toThrow(
      /Illegal round transition/,
    );
  });

  it("throws on illegal transition: manual_review cannot end_round_all_done", () => {
    expect(() => transitionRound("manual_review", "end_round_all_done")).toThrow(
      /Illegal round transition/,
    );
  });
});

describe("transition (generic overload)", () => {
  it("dispatches game action correctly", () => {
    const result: GameStatus = transition("waiting" as GameStatus, "start_game");
    expect(result).toBe("playing");
  });

  it("dispatches round action correctly", () => {
    const result: RoundStatus = transition("playing" as RoundStatus, "start_review");
    expect(result).toBe("reviewing");
  });

  it("dispatches round action with manualReview option", () => {
    const result: RoundStatus = transition(
      "playing" as RoundStatus,
      "start_review",
      { manualReview: true },
    );
    expect(result).toBe("manual_review");
  });

  it("throws for illegal game transition via generic dispatch", () => {
    expect(() => transition("finished" as GameStatus, "start_game")).toThrow(
      /Illegal game transition/,
    );
  });

  it("throws for illegal round transition via generic dispatch", () => {
    expect(() => transition("completed" as RoundStatus, "start_review")).toThrow(
      /Illegal round transition/,
    );
  });
});
