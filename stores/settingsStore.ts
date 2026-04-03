import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CategoryMode, GameMode } from "@/lib/types/game";

interface SettingsState {
  mode: GameMode;
  categoryMode: CategoryMode;
  timerSeconds: number;
  helpsPerRound: number;
  setMode: (mode: GameMode) => void;
  setCategoryMode: (mode: CategoryMode) => void;
  setTimerSeconds: (seconds: number) => void;
  setHelpsPerRound: (count: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mode: "solo",
      categoryMode: "fixed",
      timerSeconds: 180,
      helpsPerRound: 2,
      setMode: (mode) => set({ mode }),
      setCategoryMode: (categoryMode) => set({ categoryMode }),
      setTimerSeconds: (timerSeconds) => set({ timerSeconds }),
      setHelpsPerRound: (helpsPerRound) => set({ helpsPerRound }),
    }),
    {
      name: "eretz-eir:settings",
      partialize: (state) => ({
        mode: state.mode,
        categoryMode: state.categoryMode,
        timerSeconds: state.timerSeconds,
        helpsPerRound: state.helpsPerRound,
      }),
    }
  )
);
