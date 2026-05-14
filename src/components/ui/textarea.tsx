import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  surface?: "light" | "dark";
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, description, error, id, surface = "light", ...props }, ref) => {
    const reactId = React.useId();
    const textareaId = id ?? reactId;
    const describedBy = [description ? `${textareaId}-description` : null, error ? `${textareaId}-error` : null]
      .filter(Boolean)
      .join(" ");

    return (
      <label className={cn("grid gap-2 text-sm", surface === "dark" ? "text-[var(--foreground-80)]" : "text-[var(--color-ink-strong)]")}>
        {label ? <span className="font-medium">{label}</span> : null}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={cn(
            "min-h-28 w-full resize-y rounded-[8px] border-[0.8px] px-3 py-2.5 text-[15px] leading-6 outline-none transition-colors placeholder:text-current/40 focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:cursor-not-allowed disabled:opacity-50",
            surface === "dark"
              ? "border-[var(--input)] bg-[var(--foreground-5)] text-[var(--foreground-80)] caret-[var(--caret)]"
              : "border-[var(--color-border-pill)] bg-[var(--color-surface-raised)] text-[var(--foreground)] caret-[var(--tt-brand-color-500)]",
            error && "border-[var(--destructive)]",
            className
          )}
          {...props}
        />
        {description ? (
          <span id={`${textareaId}-description`} className={cn("text-xs leading-5", surface === "dark" ? "text-[var(--foreground-50)]" : "text-[var(--color-ink-faint)]")}>
            {description}
          </span>
        ) : null}
        {error ? (
          <span id={`${textareaId}-error`} className="text-xs leading-5 text-[var(--destructive)]">
            {error}
          </span>
        ) : null}
      </label>
    );
  }
);

Textarea.displayName = "Textarea";

