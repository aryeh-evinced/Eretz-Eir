interface AvatarProps {
  name: string;
  emoji?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-lg",
  lg: "w-14 h-14 text-2xl",
} as const;

export function Avatar({
  name,
  emoji,
  size = "md",
  className = "",
}: AvatarProps) {
  const display = emoji || name.charAt(0);

  return (
    <div
      className={[
        "flex items-center justify-center rounded-full bg-surface-2 border border-border font-display font-bold",
        sizeClasses[size],
        className,
      ].join(" ")}
      role="img"
      aria-label={name}
    >
      {display}
    </div>
  );
}
