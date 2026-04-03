import type { Category } from "@/lib/types/game";

export const STANDARD_CATEGORIES: readonly Category[] = [
  "ארץ",
  "עיר",
  "חי",
  "צומח",
  "ילד",
  "ילדה",
  "מקצוע",
  "זמר/ת",
] as const;

export const CATEGORY_ICONS: Record<Category, string> = {
  "ארץ": "🌍",
  "עיר": "🏙️",
  "חי": "🐾",
  "צומח": "🌿",
  "ילד": "👦",
  "ילדה": "👧",
  "מקצוע": "💼",
  "זמר/ת": "🎵",
};

export const EXTENDED_CATEGORY_POOL: readonly string[] = [
  "ארץ",
  "עיר",
  "חי",
  "צומח",
  "ילד",
  "ילדה",
  "מקצוע",
  "זמר/ת",
  "אוכל",
  "צבע",
  "כלי",
  "משחק",
  "סרט",
  "שיר",
  "ספר",
  "מותג",
  "ספורט",
  "לבוש",
  "גוף",
  "ריהוט",
] as const;
