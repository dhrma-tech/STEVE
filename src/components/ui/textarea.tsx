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
      <label className={cn("grid gap-2 text-sm", surface === "dark" ? "text-[var(--app-text)]" : "text-[var(--color-ink-strong)]")}>
        {label ? <span className="font-medium">{label}</span> : null}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={cn(
            "min-h-28 w-full resize-y rounded-[8px] border-[0.8px] px-3 py-2.5 text-[15px] leading-6 outline-none transition-colors placeholder:text-current/40 focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] disabled:cursor-not-allowed disabled:opacity-50",
            surface === "dark"
              ? "border-[var(--app-input-border)] bg-[rgba(255,255,255,0.06)] text-[var(--app-text)] caret-[var(--caret)]"
              : "border-[var(--color-border-pill)] bg-[var(--color-surface-raised)] text-[var(--foreground)] caret-[var(--brand-500)]",
            error && "border-[var(--danger)]",
            className
          )}
          {...props}
        />
        {description ? (
          <span id={`${textareaId}-description`} className={cn("text-xs leading-5", surface === "dark" ? "text-[var(--app-text-50)]" : "text-[var(--color-ink-faint)]")}>
            {description}
          </span>
        ) : null}
        {error ? (
          <span id={`${textareaId}-error`} className="text-xs leading-5 text-[var(--danger)]">
            {error}
          </span>
        ) : null}
      </label>
    );
  }
);

Textarea.displayName = "Textarea";

