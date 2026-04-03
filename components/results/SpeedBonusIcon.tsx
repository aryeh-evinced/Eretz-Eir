"use client";

interface SpeedBonusIconProps {
  bonus: number;
}

/** Lightning bolt icon shown when a player earned the speed bonus. */
export function SpeedBonusIcon({ bonus }: SpeedBonusIconProps) {
  if (bonus <= 0) return null;
  return (
    <span
      className="text-gold text-[10px] font-bold"
      title={`בונוס מהירות +${bonus}`}
      aria-label={`בונוס מהירות +${bonus}`}
    >
      ⚡+{bonus}
    </span>
  );
}
