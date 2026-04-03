import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the logger to avoid noisy output in tests
vi.mock("@/lib/observability/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Build a mock Supabase client that records calls and returns configurable data.
function createMockSupabase(config: {
  rounds?: Array<{ id: string; round_number: number }>;
  answers?: Array<{ round_id: string; player_id: string; score: number }>;
  gamePlayers?: Array<{ game_id: string; player_id: string; score_total: number }>;
}) {
  const updateCalls: Array<{ table: string; data: Record<string, unknown>; filters: Record<string, unknown> }> = [];
  const upsertCalls: Array<{ table: string; data: unknown }> = [];

  const client = {
    from: (table: string) => {
      if (table === "rounds") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: config.rounds ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "answers") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: config.answers ?? [], error: null }),
          }),
        };
      }
      if (table === "game_players") {
        return {
          update: (data: Record<string, unknown>) => ({
            eq: (col1: string, val1: unknown) => ({
              eq: (_col2: string, _val2: unknown) => {
                updateCalls.push({ table, data, filters: { [col1]: val1 } });
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }
      if (table === "game_sessions") {
        return {
          update: (data: Record<string, unknown>) => ({
            eq: (_col: string, _val: unknown) => {
              updateCalls.push({ table, data, filters: {} });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "stats_refresh_queue") {
        return {
          upsert: (data: unknown, _opts?: unknown) => {
            upsertCalls.push({ table, data });
            return Promise.resolve({ error: null });
          },
        };
      }
      return {};
    },
    _updateCalls: updateCalls,
    _upsertCalls: upsertCalls,
  };

  return client;
}

// Import after mocks are set up
import { finalizeGame } from "@/lib/game/finalScore";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("finalizeGame", () => {
  it("returns empty rankings for a game with no rounds", async () => {
    const mock = createMockSupabase({ rounds: [] });
    const result = await finalizeGame("game-1", mock as unknown as SupabaseClient);

    expect(result.rankings).toEqual([]);
    expect(result.enqueuedPlayerIds).toEqual([]);
  });

  it("computes and persists correct rankings for a multi-player game", async () => {
    const mock = createMockSupabase({
      rounds: [
        { id: "r1", round_number: 1 },
        { id: "r2", round_number: 2 },
      ],
      answers: [
        { round_id: "r1", player_id: "p1", score: 20 },
        { round_id: "r1", player_id: "p2", score: 10 },
        { round_id: "r2", player_id: "p1", score: 5 },
        { round_id: "r2", player_id: "p2", score: 15 },
      ],
    });

    const result = await finalizeGame("game-1", mock as unknown as SupabaseClient);

    // p1: 20+5=25, p2: 10+15=25 → tied at rank 1
    expect(result.rankings).toHaveLength(2);
    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[1].rank).toBe(1);
    expect(result.rankings[0].totalScore).toBe(25);

    // Should have persisted ranks
    const gamePlayerUpdates = mock._updateCalls.filter((c) => c.table === "game_players");
    expect(gamePlayerUpdates).toHaveLength(2);

    // Should have set finished_at
    const sessionUpdates = mock._updateCalls.filter((c) => c.table === "game_sessions");
    expect(sessionUpdates).toHaveLength(1);

    // Should have enqueued both players
    expect(result.enqueuedPlayerIds).toEqual(["p1", "p2"]);
    expect(mock._upsertCalls).toHaveLength(1);
  });

  it("ranks correctly when one player scores higher", async () => {
    const mock = createMockSupabase({
      rounds: [{ id: "r1", round_number: 1 }],
      answers: [
        { round_id: "r1", player_id: "p1", score: 30 },
        { round_id: "r1", player_id: "p2", score: 10 },
        { round_id: "r1", player_id: "p3", score: 20 },
      ],
    });

    const result = await finalizeGame("game-1", mock as unknown as SupabaseClient);

    expect(result.rankings).toHaveLength(3);
    const p1 = result.rankings.find((r) => r.playerId === "p1")!;
    const p2 = result.rankings.find((r) => r.playerId === "p2")!;
    const p3 = result.rankings.find((r) => r.playerId === "p3")!;

    expect(p1.rank).toBe(1);
    expect(p1.totalScore).toBe(30);
    expect(p3.rank).toBe(2);
    expect(p3.totalScore).toBe(20);
    expect(p2.rank).toBe(3);
    expect(p2.totalScore).toBe(10);
  });

  it("handles single player game", async () => {
    const mock = createMockSupabase({
      rounds: [{ id: "r1", round_number: 1 }],
      answers: [{ round_id: "r1", player_id: "p1", score: 42 }],
    });

    const result = await finalizeGame("game-1", mock as unknown as SupabaseClient);

    expect(result.rankings).toHaveLength(1);
    expect(result.rankings[0]).toEqual({ playerId: "p1", totalScore: 42, rank: 1 });
    expect(result.enqueuedPlayerIds).toEqual(["p1"]);
  });
});
