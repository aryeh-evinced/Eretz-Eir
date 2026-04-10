export type HebrewLetter =
  | "א"
  | "ב"
  | "ג"
  | "ד"
  | "ה"
  | "ו"
  | "ז"
  | "ח"
  | "ט"
  | "י"
  | "כ"
  | "ל"
  | "מ"
  | "נ"
  | "ס"
  | "ע"
  | "פ"
  | "צ"
  | "ק"
  | "ר"
  | "ש"
  | "ת";

export type Category =
  | "ארץ"
  | "עיר"
  | "חי"
  | "צומח"
  | "ילד"
  | "ילדה"
  | "מקצוע"
  | "זמר/ת"
  | "אוכל"
  | "סרט"
  | "שיר"
  | "ספר"
  | "מותג"
  | "ספורט";

export type GameMode = "solo" | "multiplayer";
export type CategoryMode = "fixed" | "custom" | "random";
export type GameStatus = "waiting" | "playing" | "finished";
export type RoundStatus = "playing" | "reviewing" | "manual_review" | "completed";
export type RoundEndReason = "timer" | "all_done";
export type HelpUsed = "none" | "hint" | "full";
export type AgeGroup = "child" | "teen" | "adult";

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  ageGroup: AgeGroup;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerStats {
  playerId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  avgScorePerRound: number;
  uniqueAnswersCount: number;
  fastestAnswerMs: number | null;
  strongestCategory: Category | null;
  weakestCategory: Category | null;
}

export interface GameSession {
  id: string;
  mode: GameMode;
  status: GameStatus;
  categoryMode: CategoryMode;
  categories: Category[];
  timerSeconds: number;
  helpsPerRound: number;
  createdBy: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface Round {
  id: string;
  gameId: string;
  roundNumber: number;
  letter: HebrewLetter;
  categories: Category[];
  status: RoundStatus;
  startedAt: string;
  endedAt: string | null;
  endedBy: RoundEndReason | null;
}

export interface Answer {
  id: string;
  roundId: string;
  playerId: string;
  category: Category;
  answerText: string | null;
  submittedAt: string | null;
  isValid: boolean | null;
  startsWithLetter: boolean | null;
  isRealWord: boolean | null;
  matchesCategory: boolean | null;
  aiExplanation: string | null;
  isUnique: boolean | null;
  helpUsed: HelpUsed;
  speedBonus: boolean;
  score: number;
}

export interface ValidatedAnswer {
  playerId: string;
  category: Category;
  text: string;
  submittedAt: string;
  isValid: boolean;
  isUnique: boolean;
}

export interface AnswerScore {
  base: number;
  speedBonus: number;
  total: number;
}

export interface DifficultyState {
  playerAvgScorePerRound: number;
  playerUniqueRatio: number;
  playerEmptyRatio: number;
  roundsPlayed: number;
}

export interface AICompetitor {
  name: string;
  age: number;
  description: string;
  emptyProbability: number;
  mistakeProbability: number;
  expectedScore: number;
}

export interface RoundAnswers {
  roundId: string;
  letter: HebrewLetter;
  answers: { category: Category; text: string }[];
}
