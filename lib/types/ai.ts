import type { Category } from "./game";

export interface AnswerValidation {
  category: Category;
  text: string;
  isValid: boolean;
  startsWithLetter: boolean;
  isRealWord: boolean;
  matchesCategory: boolean;
  explanation: string;
}

export interface ValidationResult {
  validations: AnswerValidation[];
}

export interface HintResponse {
  text: string;
}

export interface CompetitorAnswer {
  category: Category;
  text: string;
}

export interface CompetitorGenerationResult {
  answers: CompetitorAnswer[];
}
