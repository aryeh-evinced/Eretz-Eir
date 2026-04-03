import type { GameSession, Round, ValidatedAnswer, HebrewLetter, Category, GameMode, CategoryMode } from "@/lib/types/game";
import { drawLetter } from "./letters";
import { getCategories } from "./categoryPool";
import { scoreAnswer } from "./scoring";

export interface GameSettings {
  mode: GameMode;
  categoryMode: CategoryMode;
  timerSeconds: number;
  helpsPerRound: number;
  customCategories?: Category[];
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createGameSession(
  settings: GameSettings,
  createdBy: string = "local"
): GameSession {
  const categories = getCategories(settings.categoryMode, settings.customCategories);
  return {
    id: randomId(),
    mode: settings.mode,
    status: "playing",
    categoryMode: settings.categoryMode,
    categories,
    timerSeconds: settings.timerSeconds,
    helpsPerRound: settings.helpsPerRound,
    createdBy,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
}

export function createRound(
  session: GameSession,
  roundNumber: number,
  excludeLetters: HebrewLetter[] = []
): Round {
  return {
    id: randomId(),
    gameId: session.id,
    roundNumber,
    letter: drawLetter(excludeLetters),
    categories: session.categories,
    status: "playing",
    startedAt: new Date().toISOString(),
    endedAt: null,
    endedBy: null,
  };
}

/**
 * Score all answers in a round and return a map of playerId → total score.
 */
export function calculateRoundScores(allAnswers: ValidatedAnswer[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const answer of allAnswers) {
    const { total } = scoreAnswer(answer, allAnswers);
    scores.set(answer.playerId, (scores.get(answer.playerId) ?? 0) + total);
  }
  return scores;
}

export interface FinalStanding {
  playerId: string;
  totalScore: number;
  rank: number;
}

/**
 * Compute final standings from per-round score maps.
 */
export function finalizeGame(roundScores: Map<string, number>[]): FinalStanding[] {
  const totals = new Map<string, number>();
  for (const roundScore of roundScores) {
    for (const [playerId, score] of roundScore) {
      totals.set(playerId, (totals.get(playerId) ?? 0) + score);
    }
  }

  const standings: FinalStanding[] = Array.from(totals.entries())
    .map(([playerId, totalScore]) => ({ playerId, totalScore, rank: 0 }))
    .sort((a, b) => b.totalScore - a.totalScore);

  standings.forEach((s, i) => {
    s.rank = i + 1;
  });

  return standings;
}
