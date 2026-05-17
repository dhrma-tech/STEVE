import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  surface?: "light" | "dark";
  startIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, description, error, id, surface = "light", startIcon, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const describedBy = [description ? `${inputId}-description` : null, error ? `${inputId}-error` : null]
      .filter(Boolean)
      .join(" ");

    const inputElement = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={cn(
          "h-10 w-full rounded-[8px] border-[0.8px] px-3 text-[15px] outline-none transition-colors placeholder:text-current/40 focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:cursor-not-allowed disabled:opacity-50",
          surface === "dark"
            ? "border-[var(--input)] bg-[var(--foreground-5)] text-[var(--foreground-80)] caret-[var(--caret)]"
            : "border-[var(--color-border-pill)] bg-[var(--color-surface-raised)] text-[var(--foreground)] caret-[var(--tt-brand-color-500)]",
          startIcon && "pl-9",
          error && "border-[var(--destructive)]",
          className
        )}
        {...props}
      />
    );

    return (
      <label className={cn("grid gap-2 text-sm", surface === "dark" ? "text-[var(--foreground-80)]" : "text-[var(--color-ink-strong)]")}>
        {label ? <span className="font-medium">{label}</span> : null}
        {startIcon ? (
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--foreground-50)]">
              {startIcon}
            </div>
            {inputElement}
          </div>
        ) : (
          inputElement
        )}
        {description ? (
          <span id={`${inputId}-description`} className={cn("text-xs leading-5", surface === "dark" ? "text-[var(--foreground-50)]" : "text-[var(--color-ink-faint)]")}>
            {description}
          </span>
        ) : null}
        {error ? (
          <span id={`${inputId}-error`} className="text-xs leading-5 text-[var(--destructive)]">
            {error}
          </span>
        ) : null}
      </label>
    );
  }
);

Input.displayName = "Input";

