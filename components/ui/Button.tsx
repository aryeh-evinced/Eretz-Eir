"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

const variantClasses = {
  primary:
    "bg-accent hover:bg-accent/90 text-white border-accent shadow-md shadow-accent/20",
  secondary:
    "bg-transparent hover:bg-surface-2 text-text-primary border-border",
  danger: "bg-red-600 hover:bg-red-700 text-white border-red-600",
  ghost: "bg-transparent hover:bg-surface-2 text-text-primary border-transparent",
} as const;

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm min-h-[36px]",
  md: "px-5 py-2.5 text-base min-h-[44px]",
  lg: "px-7 py-3.5 text-lg min-h-[52px]",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-game border font-medium",
          "transition-all duration-150",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal focus-visible:outline-offset-2",
          "active:scale-95 motion-reduce:active:scale-100",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? "w-full" : "",
          className,
        ].join(" ")}
        {...props}
      >
        {loading && (
          <span
            className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
