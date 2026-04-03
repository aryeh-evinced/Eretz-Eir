import { describe, it, expect } from "vitest";
import { computeRoundRanking, computeGameRanking } from "@/lib/game/ranking";

describe("computeRoundRanking", () => {
  it("returns empty array for empty map", () => {
    expect(computeRoundRanking(new Map())).toEqual([]);
  });

  it("single player ranks first", () => {
    const scores = new Map([["p1", 30]]);
    const result = computeRoundRanking(scores);
    expect(result).toEqual([{ playerId: "p1", totalScore: 30, rank: 1 }]);
  });

  it("ranks players in descending score order", () => {
    const scores = new Map([
      ["p1", 10],
      ["p2", 30],
      ["p3", 20],
    ]);
    const result = computeRoundRanking(scores);
    expect(result[0]).toEqual({ playerId: "p2", totalScore: 30, rank: 1 });
    expect(result[1]).toEqual({ playerId: "p3", totalScore: 20, rank: 2 });
    expect(result[2]).toEqual({ playerId: "p1", totalScore: 10, rank: 3 });
  });

  it("ties get the same rank (competition ranking)", () => {
    const scores = new Map([
      ["p1", 20],
      ["p2", 20],
      ["p3", 10],
    ]);
    const result = computeRoundRanking(scores);
    const p1 = result.find((r) => r.playerId === "p1")!;
    const p2 = result.find((r) => r.playerId === "p2")!;
    const p3 = result.find((r) => r.playerId === "p3")!;
    expect(p1.rank).toBe(1);
    expect(p2.rank).toBe(1);
    // After two players tied at rank 1, next rank is 3
    expect(p3.rank).toBe(3);
  });

  it("all players tied — all rank 1", () => {
    const scores = new Map([
      ["p1", 15],
      ["p2", 15],
      ["p3", 15],
    ]);
    const result = computeRoundRanking(scores);
    for (const r of result) {
      expect(r.rank).toBe(1);
      expect(r.totalScore).toBe(15);
    }
  });

  it("zero-score player ranked last", () => {
    const scores = new Map([
      ["p1", 0],
      ["p2", 10],
    ]);
    const result = computeRoundRanking(scores);
    expect(result[0]).toEqual({ playerId: "p2", totalScore: 10, rank: 1 });
    expect(result[1]).toEqual({ playerId: "p1", totalScore: 0, rank: 2 });
  });
});

describe("computeGameRanking", () => {
  it("returns empty array for empty input", () => {
    expect(computeGameRanking([])).toEqual([]);
  });

  it("returns empty array when no players across rounds", () => {
    expect(computeGameRanking([new Map(), new Map()])).toEqual([]);
  });

  it("aggregates scores across rounds", () => {
    const round1 = new Map([
      ["p1", 20],
      ["p2", 10],
    ]);
    const round2 = new Map([
      ["p1", 5],
      ["p2", 15],
    ]);
    const result = computeGameRanking([round1, round2]);
    const p1 = result.find((r) => r.playerId === "p1")!;
    const p2 = result.find((r) => r.playerId === "p2")!;
    expect(p1.totalScore).toBe(25);
    expect(p2.totalScore).toBe(25);
    // Both tied → rank 1
    expect(p1.rank).toBe(1);
    expect(p2.rank).toBe(1);
  });

  it("player missing from a round scores 0 for that round", () => {
    const round1 = new Map([
      ["p1", 20],
      ["p2", 10],
    ]);
    const round2 = new Map([["p1", 5]]); // p2 absent
    const result = computeGameRanking([round1, round2]);
    const p1 = result.find((r) => r.playerId === "p1")!;
    const p2 = result.find((r) => r.playerId === "p2")!;
    expect(p1.totalScore).toBe(25);
    expect(p2.totalScore).toBe(10);
    expect(p1.rank).toBe(1);
    expect(p2.rank).toBe(2);
  });

  it("single round delegates correctly to computeRoundRanking", () => {
    const round = new Map([
      ["p1", 30],
      ["p2", 20],
    ]);
    const result = computeGameRanking([round]);
    expect(result[0]).toEqual({ playerId: "p1", totalScore: 30, rank: 1 });
    expect(result[1]).toEqual({ playerId: "p2", totalScore: 20, rank: 2 });
  });
});
