import type { Category, CategoryMode } from "@/lib/types/game";
import { STANDARD_CATEGORIES, EXTENDED_CATEGORY_POOL } from "@/lib/constants/categories";

/**
 * Return the category list for a game session based on the selected mode.
 *
 * - fixed:  the 8 standard categories
 * - custom: caller-provided list, falling back to standard if empty
 * - random: 6 randomly sampled from the extended pool
 */
export function getCategories(mode: CategoryMode, customCategories?: Category[]): Category[] {
  switch (mode) {
    case "fixed":
      return [...STANDARD_CATEGORIES];

    case "custom":
      return customCategories && customCategories.length > 0
        ? customCategories
        : [...STANDARD_CATEGORIES];

    case "random": {
      // Shuffle the extended pool and take 6
      const pool = [...EXTENDED_CATEGORY_POOL] as string[];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      // Cast: extended pool entries are valid display categories even if not
      // all are in the strict Category union type yet.
      return pool.slice(0, 6) as Category[];
    }
  }
}
