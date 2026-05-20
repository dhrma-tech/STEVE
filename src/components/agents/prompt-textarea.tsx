"use client";

import { cn } from "@/lib/utils/cn";

const PROMPT_PLACEHOLDERS: Record<string, string> = {
  engineering: "e.g. Always use TypeScript strict mode. Prefer functional components. Add error boundaries to all async operations.",
  marketing: "e.g. Write in a casual, direct tone. Avoid corporate language. Keep CTAs under 5 words.",
  sales: "e.g. Focus on pain points before solutions. Keep outreach under 150 words. Always include one specific company insight.",
  design: "e.g. Prefer minimal aesthetics. Use Inter for body text. Accessibility is non-negotiable — 4.5:1 contrast minimum.",
  support: "e.g. Always acknowledge the customer frustration first. Offer next steps, not just answers.",
  operations: "e.g. Every process must have a named owner. Document edge cases, not just happy paths.",
  finance: "e.g. Always distinguish estimates from actuals. Label all projections clearly. Flag every assumption in the model.",
  legal: "e.g. Always note jurisdiction. Flag any action requiring human legal review. Never imply this is legal advice.",
};

const MAX_CHARS = 500;

interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  departmentSlug?: string;
  disabled?: boolean;
  label?: string;
}

export function PromptTextarea({ value, onChange, departmentSlug, disabled, label }: PromptTextareaProps) {
  const charCount = value.length;
  const isNearLimit = charCount > 450;
  const isAtLimit = charCount >= MAX_CHARS;

  const counterColor = isAtLimit
    ? "text-red-400"
    : isNearLimit
    ? "text-amber-400"
    : "text-[var(--foreground-30)]";

  const placeholder = departmentSlug
    ? (PROMPT_PLACEHOLDERS[departmentSlug] ?? "Add custom instructions for this agent…")
    : "Add custom instructions for this agent…";

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <p className="text-sm font-medium">{label}</p> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={MAX_CHARS}
        disabled={disabled}
        rows={3}
        onFocus={(e) => { e.target.rows = 5; }}
        onBlur={(e) => { if (!value) e.target.rows = 3; }}
        className={cn(
          "w-full resize-none rounded-[10px] border bg-[var(--foreground-3)] px-3 py-2 text-sm text-[var(--foreground-80)] transition-[border-color,rows] duration-150",
          "placeholder:text-[var(--foreground-20)] focus:outline-none focus:ring-1 focus:ring-[var(--focused)] disabled:opacity-50",
          isAtLimit
            ? "border-red-400/50 focus:ring-red-400/30"
            : "border-[var(--border-10)]"
        )}
      />
      <div className="flex justify-end">
        <span className={cn("text-xs tabular-nums", counterColor)}>
          {charCount} / {MAX_CHARS}
        </span>
      </div>
    </div>
  );
}
