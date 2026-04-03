import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Build a mock Supabase client that supports the chained query patterns
 * used by rebuildPlayerStats.
 */
function createMockSupabase(config: {
  gamePlayers?: Array<{
    game_id: string;
    score_total: number;
    rank: number | null;
    game_sessions: { status: string };
  }>;
  rounds?: Array<{ id: string; started_at: string }>;
  answers?: Array<{
    round_id: string;
    category: string;
    is_valid: boolean;
    is_unique: boolean;
    submitted_at: string | null;
    answer_text: string | null;
  }>;
}) {
  const upsertCalls: Array<{ table: string; data: unknown }> = [];

  const client = {
    from: (table: string) => {
      if (table === "game_players") {
        return {
          select: () => ({
            eq: (_col: string, _val: unknown) => ({
              eq: () => Promise.resolve({ data: config.gamePlayers ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "rounds") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: config.rounds ?? [], error: null }),
          }),
        };
      }
      if (table === "answers") {
        return {
          select: () => ({
            eq: (_col: string, _val: unknown) => ({
              in: () => Promise.resolve({ data: config.answers ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "player_stats") {
        return {
          upsert: (data: unknown, _opts?: unknown) => {
            upsertCalls.push({ table, data });
            return Promise.resolve({ error: null });
          },
        };
      }
      return {};
    },
    _upsertCalls: upsertCalls,
  };

  return client;
}

import { rebuildPlayerStats } from "@/lib/stats/rebuildPlayerStats";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("rebuildPlayerStats", () => {
  it("returns empty array for empty input", async () => {
    const mock = createMockSupabase({});
    const result = await rebuildPlayerStats([], mock as unknown as SupabaseClient);
    expect(result).toEqual([]);
  });

  it("computes stats correctly for a player with finished games", async () => {
    const mock = createMockSupabase({
      gamePlayers: [
        { game_id: "g1", score_total: 50, rank: 1, game_sessions: { status: "finished" } },
        { game_id: "g2", score_total: 30, rank: 2, game_sessions: { status: "finished" } },
      ],
      rounds: [
        { id: "r1", started_at: "2026-01-01T10:00:00Z" },
        { id: "r2", started_at: "2026-01-01T10:05:00Z" },
        { id: "r3", started_at: "2026-01-01T11:00:00Z" },
      ],
      answers: [
        {
          round_id: "r1",
          category: "ארץ",
          is_valid: true,
          is_unique: true,
          submitted_at: "2026-01-01T10:00:05Z",
          answer_text: "אנגליה",
        },
        {
          round_id: "r1",
          category: "עיר",
          is_valid: true,
          is_unique: false,
          submitted_at: "2026-01-01T10:00:10Z",
          answer_text: "אשדוד",
        },
        {
          round_id: "r2",
          category: "ארץ",
          is_valid: false,
          is_unique: false,
          submitted_at: null,
          answer_text: "xxx",
        },
      ],
    });

    const result = await rebuildPlayerStats(["p1"], mock as unknown as SupabaseClient);

    expect(result).toHaveLength(1);
    const stats = result[0];
    expect(stats.playerId).toBe("p1");
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.gamesWon).toBe(1); // rank 1 in game g1
    expect(stats.totalScore).toBe(80); // 50 + 30
    expect(stats.uniqueAnswersCount).toBe(1); // only the first answer
    expect(stats.fastestAnswerMs).toBe(5000); // 5 seconds from round start
    expect(stats.strongestCategory).toBe("עיר"); // 1/1 valid
    expect(stats.weakestCategory).toBe("ארץ"); // 1/2 valid

    // Should have upserted to player_stats
    expect(mock._upsertCalls).toHaveLength(1);
    expect((mock._upsertCalls[0].data as Record<string, unknown>).player_id).toBe("p1");
  });

  it("handles player with no finished games", async () => {
    const mock = createMockSupabase({
      gamePlayers: [], // no finished games
    });

    const result = await rebuildPlayerStats(["p1"], mock as unknown as SupabaseClient);

    expect(result).toHaveLength(1);
    const stats = result[0];
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.gamesWon).toBe(0);
    expect(stats.totalScore).toBe(0);
    expect(stats.avgScorePerRound).toBe(0);
    expect(stats.uniqueAnswersCount).toBe(0);
    expect(stats.fastestAnswerMs).toBeNull();
    expect(stats.strongestCategory).toBeNull();
    expect(stats.weakestCategory).toBeNull();
  });
});
