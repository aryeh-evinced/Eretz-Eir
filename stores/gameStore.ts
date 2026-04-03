"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameSession, Round } from "@/lib/types/game";
import { createGameSession, createRound } from "@/lib/game/session";
import type { GameSettings } from "@/lib/game/session";
import { CURRENT_SCHEMA_VERSION } from "@/lib/storage/localGame";

export type { GameSettings };

interface GameState {
  session: GameSession | null;
  currentRound: Round | null;
  answers: Record<string, string>;
  settings: GameSettings;
  schemaVersion: number;

  // Actions
  startGame: (settings: GameSettings) => void;
  setAnswer: (category: string, text: string) => void;
  submitRound: () => void;
  nextRound: () => void;
  endGame: () => void;
  recoverGame: () => boolean;
  clearGame: () => void;
}

const defaultSettings: GameSettings = {
  mode: "solo",
  categoryMode: "fixed",
  timerSeconds: 180,
  helpsPerRound: 2,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      session: null,
      currentRound: null,
      answers: {},
      settings: defaultSettings,
      schemaVersion: CURRENT_SCHEMA_VERSION,

      startGame: (settings) => {
        const session = createGameSession(settings);
        const round = createRound(session, 1);
        set({
          session,
          currentRound: round,
          answers: {},
          settings,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        });
      },

      setAnswer: (category, text) => {
        set((state) => ({
          answers: { ...state.answers, [category]: text },
        }));
      },

      submitRound: () => {
        const { currentRound } = get();
        if (!currentRound) return;
        set({
          currentRound: {
            ...currentRound,
            status: "reviewing",
            endedAt: new Date().toISOString(),
            endedBy: "timer",
          },
        });
      },

      nextRound: () => {
        const { session, currentRound } = get();
        if (!session || !currentRound) return;
        const round = createRound(session, currentRound.roundNumber + 1);
        set({ currentRound: round, answers: {} });
      },

      endGame: () => {
        const { session } = get();
        if (!session) return;
        set({
          session: {
            ...session,
            status: "finished",
            finishedAt: new Date().toISOString(),
          },
        });
      },

      recoverGame: () => {
        const { session } = get();
        return session !== null && session.status === "playing";
      },

      clearGame: () => {
        set({ session: null, currentRound: null, answers: {} });
      },
    }),
    {
      name: "eretz-eir:current-game",
      partialize: (state) => ({
        session: state.session,
        currentRound: state.currentRound,
        answers: state.answers,
        settings: state.settings,
        schemaVersion: state.schemaVersion,
      }),
    }
  )
);
