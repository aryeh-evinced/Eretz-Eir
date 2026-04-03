import { z } from "zod";

const GAME_KEY = "eretz-eir:current-game";
const HISTORY_KEY = "eretz-eir:game-history";

export const CURRENT_SCHEMA_VERSION = 1;

const GameSettingsSchema = z.object({
  mode: z.enum(["solo", "multiplayer"]),
  categoryMode: z.enum(["fixed", "custom", "random"]),
  timerSeconds: z.number().int().positive(),
  helpsPerRound: z.number().int().min(0),
});

const StoredGameStateSchema = z.object({
  schemaVersion: z.number().int(),
  sessionId: z.string(),
  mode: z.enum(["solo", "multiplayer"]),
  status: z.enum(["waiting", "playing", "finished"]),
  roundNumber: z.number().int().min(1),
  letter: z.string().nullable(),
  answers: z.record(z.string()),
  settings: GameSettingsSchema,
  startedAt: z.string(),
});

export type StoredGameSettings = z.infer<typeof GameSettingsSchema>;
export type StoredGameState = z.infer<typeof StoredGameStateSchema>;

export interface GameHistoryEntry {
  id: string;
  startedAt: string;
  finishedAt: string;
  mode: string;
  score: number;
  won: boolean;
  rounds: number;
}

export function saveGameState(state: StoredGameState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GAME_KEY, JSON.stringify(state));
}

export function loadGameState(): StoredGameState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = StoredGameStateSchema.safeParse(parsed);
    if (!result.success) return null;
    if (result.data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      // Discard incompatible schema versions — no migration path yet
      clearGameState();
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(GAME_KEY);
}

export function appendGameHistory(entry: GameHistoryEntry): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: GameHistoryEntry[] = raw ? (JSON.parse(raw) as GameHistoryEntry[]) : [];
    history.unshift(entry);
    // Keep last 50 games
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch {
    // ignore
  }
}

export function loadGameHistory(): GameHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GameHistoryEntry[];
  } catch {
    return [];
  }
}
