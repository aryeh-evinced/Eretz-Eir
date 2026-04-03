interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-10 h-10 border-[3px]",
} as const;

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="טוען"
      className={[
        "inline-block rounded-full border-accent border-t-transparent",
        "animate-spin motion-reduce:animate-none",
        sizeClasses[size],
        className,
      ].join(" ")}
    />
  );
}
