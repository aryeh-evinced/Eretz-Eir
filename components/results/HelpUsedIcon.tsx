"use client";

import type { HelpUsed } from "@/lib/types/game";

interface HelpUsedIconProps {
  helpUsed: HelpUsed;
}

/** Shows what level of help the player used for this answer. */
export function HelpUsedIcon({ helpUsed }: HelpUsedIconProps) {
  if (helpUsed === "none") return null;
  return (
    <span
      className="text-[10px]"
      title={helpUsed === "hint" ? "רמז" : "מילוי אוטומטי"}
      aria-label={helpUsed === "hint" ? "רמז" : "מילוי אוטומטי"}
    >
      {helpUsed === "hint" ? "💡" : "✨"}
    </span>
  );
}
