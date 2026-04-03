"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateLocalId, savePlayer, loadPlayer } from "@/lib/storage/localPlayer";
import type { LinkState } from "@/lib/storage/localPlayer";

interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
}

interface PlayerState {
  localId: string;
  name: string;
  avatar: string;
  supabaseId: string | null;
  linkState: LinkState;
  stats: PlayerStats;

  // Actions
  createProfile: (name: string, avatar: string) => void;
  updateProfile: (partial: Partial<{ name: string; avatar: string }>) => void;
  loadProfile: () => void;
  recordGame: (won: boolean, score: number) => void;
  hasProfile: () => boolean;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      localId: "",
      name: "",
      avatar: "🦊",
      supabaseId: null,
      linkState: "unlinked",
      stats: { gamesPlayed: 0, gamesWon: 0, totalScore: 0 },

      createProfile: (name, avatar) => {
        const existing = get();
        const localId = existing.localId || generateLocalId();
        set({ localId, name, avatar });
        savePlayer({
          localId,
          name,
          avatar,
          supabaseId: existing.supabaseId,
          linkState: existing.linkState,
          stats: existing.stats,
        });
      },

      updateProfile: (partial) => {
        const state = get();
        set(partial);
        savePlayer({
          localId: state.localId,
          name: partial.name ?? state.name,
          avatar: partial.avatar ?? state.avatar,
          supabaseId: state.supabaseId,
          linkState: state.linkState,
          stats: state.stats,
        });
      },

      loadProfile: () => {
        const saved = loadPlayer();
        if (!saved) return;
        set({
          localId: saved.localId,
          name: saved.name,
          avatar: saved.avatar,
          supabaseId: saved.supabaseId,
          linkState: saved.linkState,
          stats: saved.stats,
        });
      },

      recordGame: (won, score) => {
        const { stats } = get();
        set({
          stats: {
            gamesPlayed: stats.gamesPlayed + 1,
            gamesWon: won ? stats.gamesWon + 1 : stats.gamesWon,
            totalScore: stats.totalScore + score,
          },
        });
      },

      hasProfile: () => {
        const { name } = get();
        return name.trim().length > 0;
      },
    }),
    {
      name: "eretz-eir:player",
      partialize: (state) => ({
        localId: state.localId,
        name: state.name,
        avatar: state.avatar,
        supabaseId: state.supabaseId,
        linkState: state.linkState,
        stats: state.stats,
      }),
    }
  )
);
