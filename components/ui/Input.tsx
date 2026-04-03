"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id: propId, ...props }, ref) => {
    const autoId = useId();
    const id = propId || autoId;
    const errorId = `${id}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={[
            "w-full rounded-game border bg-surface-2 px-4 py-2.5 text-base text-text-primary",
            "placeholder:text-text-dim",
            "focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal",
            "transition-colors duration-150",
            "min-h-[44px]",
            error ? "border-accent" : "border-border",
            className,
          ].join(" ")}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-accent">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
