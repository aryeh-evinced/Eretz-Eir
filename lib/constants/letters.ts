import type { HebrewLetter } from "@/lib/types/game";

/** Valid game letters — excludes final forms (ך, ם, ן, ף, ץ) */
export const GAME_LETTERS: readonly HebrewLetter[] = [
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "כ",
  "ל",
  "מ",
  "נ",
  "ס",
  "ע",
  "פ",
  "צ",
  "ק",
  "ר",
  "ש",
  "ת",
] as const;
