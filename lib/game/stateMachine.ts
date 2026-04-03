import type { GameStatus, RoundStatus } from "@/lib/types/game";

export type GameAction =
  | "start_game"
  | "finish_game";

export type RoundAction =
  | "end_round_timer"
  | "end_round_all_done"
  | "start_review"
  | "complete_review";

/**
 * Legal game state transitions.
 *   waiting -> playing  (start_game)
 *   playing -> finished (finish_game)
 */
const GAME_TRANSITIONS: Record<GameStatus, Partial<Record<GameAction, GameStatus>>> = {
  waiting: {
    start_game: "playing",
  },
  playing: {
    finish_game: "finished",
  },
  finished: {},
};

/**
 * Legal round state transitions.
 *   playing        -> reviewing    (start_review after timer or all-done)
 *   playing        -> manual_review (start_review when AI validation flags need human check)
 *   reviewing      -> completed    (complete_review)
 *   manual_review  -> completed    (complete_review)
 *
 * end_round_timer / end_round_all_done do not change RoundStatus themselves —
 * they represent the external event that triggers start_review.  They are kept
 * as valid actions on "playing" so callers can record end reason before calling
 * start_review.  The resulting status remains "playing" (no-op status change).
 */
const ROUND_TRANSITIONS: Record<RoundStatus, Partial<Record<RoundAction, RoundStatus>>> = {
  playing: {
    end_round_timer: "playing",     // records end reason; caller must follow with start_review
    end_round_all_done: "playing",  // same
    start_review: "reviewing",
  },
  reviewing: {
    complete_review: "completed",
  },
  manual_review: {
    complete_review: "completed",
  },
  completed: {},
};

/**
 * Transition a game from its current status via the given action.
 * Throws if the transition is illegal.
 */
export function transitionGame(currentStatus: GameStatus, action: GameAction): GameStatus {
  const next = GAME_TRANSITIONS[currentStatus]?.[action];
  if (next === undefined) {
    throw new Error(
      `Illegal game transition: cannot apply action "${action}" in status "${currentStatus}"`,
    );
  }
  return next;
}

/**
 * Transition a round from its current status via the given action.
 * Throws if the transition is illegal.
 *
 * Note: end_round_timer and end_round_all_done return the same status ("playing")
 * to signal that the round has ended but review has not yet started.
 * Callers should follow immediately with start_review (or start_review routed to
 * manual_review by passing the optional flag).
 */
export function transitionRound(
  currentStatus: RoundStatus,
  action: RoundAction,
  options?: { manualReview?: boolean },
): RoundStatus {
  const next = ROUND_TRANSITIONS[currentStatus]?.[action];
  if (next === undefined) {
    throw new Error(
      `Illegal round transition: cannot apply action "${action}" in status "${currentStatus}"`,
    );
  }

  // If the caller requests manual review on start_review, route to manual_review instead.
  if (action === "start_review" && options?.manualReview) {
    return "manual_review";
  }

  return next;
}

/**
 * Generic transition function that handles both game and round transitions.
 * Accepts a union of all action types and dispatches based on the current status type.
 *
 * For game-level actions pass a GameStatus; for round-level actions pass a RoundStatus.
 * Throws on illegal transitions.
 */
export function transition(
  currentStatus: GameStatus,
  action: GameAction,
): GameStatus;
export function transition(
  currentStatus: RoundStatus,
  action: RoundAction,
  options?: { manualReview?: boolean },
): RoundStatus;
export function transition(
  currentStatus: GameStatus | RoundStatus,
  action: GameAction | RoundAction,
  options?: { manualReview?: boolean },
): GameStatus | RoundStatus {
  // Determine which machine to use by checking if the action belongs to game transitions.
  const gameActions: GameAction[] = ["start_game", "finish_game"];
  if (gameActions.includes(action as GameAction)) {
    return transitionGame(currentStatus as GameStatus, action as GameAction);
  }
  return transitionRound(currentStatus as RoundStatus, action as RoundAction, options);
}
