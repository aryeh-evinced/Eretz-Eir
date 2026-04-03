type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof variantClasses;
};

const variantClasses = {
  default: "border border-border bg-surface",
  accent: "border border-accent/30 bg-accent/5",
  ghost: "border border-transparent bg-transparent",
  elevated: "border border-border bg-surface-2 shadow-md",
} as const;

export function Card({
  children,
  className = "",
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-game p-4",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
