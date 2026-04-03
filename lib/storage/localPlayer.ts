const PLAYER_KEY = "eretz-eir:player-data";

export type LinkState = "unlinked" | "link_pending" | "linked" | "link_failed";

export interface StoredPlayer {
  localId: string;
  name: string;
  avatar: string;
  supabaseId: string | null;
  linkState: LinkState;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalScore: number;
  };
}

export function generateLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function savePlayer(data: StoredPlayer): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PLAYER_KEY, JSON.stringify(data));
}

export function loadPlayer(): StoredPlayer | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPlayer;
  } catch {
    return null;
  }
}

export function clearPlayer(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PLAYER_KEY);
}

// Identity link state machine helpers

export function canLink(state: LinkState): boolean {
  return state === "unlinked" || state === "link_failed";
}

export function isLinked(state: LinkState): boolean {
  return state === "linked";
}

export function linkTransition(
  current: LinkState,
  event: "start" | "success" | "fail" | "unlink"
): LinkState {
  switch (event) {
    case "start":
      return canLink(current) ? "link_pending" : current;
    case "success":
      return current === "link_pending" ? "linked" : current;
    case "fail":
      return current === "link_pending" ? "link_failed" : current;
    case "unlink":
      return "unlinked";
  }
}
