const variantClasses = {
  default: "bg-surface-2 text-text-dim border-border",
  success: "bg-teal/10 text-teal border-teal/30",
  warning: "bg-gold/10 text-gold border-gold/30",
  accent: "bg-accent/10 text-accent border-accent/30",
} as const;

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
} as const;

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  icon?: string;
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  icon,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 font-medium rounded-full border",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
