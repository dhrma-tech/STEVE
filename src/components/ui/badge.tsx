import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "neutral" | "success" | "running" | "warning" | "danger" | "brand";

const variantClasses: Record<BadgeVariant, string> = {
  neutral:
    "border-[var(--border-15)] bg-[var(--foreground-8)] text-[var(--foreground-60)]",
  success:
    "border-[var(--success-40)] bg-[var(--success-30)] text-[var(--success-100)]",
  running:
    "border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.14)] text-[var(--tt-color-text-blue)]",
  warning:
    "border-[var(--tt-color-text-yellow-contrast)] bg-[var(--tt-color-text-yellow-contrast)] text-[var(--tt-color-text-yellow)]",
  danger:
    "border-[var(--tt-color-text-red-contrast)] bg-[var(--tt-color-text-red-contrast)] text-[var(--tt-color-text-red)]",
  brand:
    "border-[var(--tt-brand-color-300)]/40 bg-[var(--tt-brand-color-500)]/20 text-[var(--tt-brand-color-300)]"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2 py-1 text-xs font-medium leading-none tracking-[0px]",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export type TaskStatus = "queued" | "running" | "finished_turn" | "ready_to_review" | "completed" | "blocked" | "canceled";

const taskStatusMap: Record<TaskStatus, { label: string; variant: BadgeVariant; dot: string }> = {
  queued: { label: "Queued", variant: "neutral", dot: "bg-[var(--foreground-30)]" },
  running: { label: "Running", variant: "running", dot: "bg-[var(--running)]" },
  finished_turn: { label: "Finished turn", variant: "running", dot: "bg-[var(--running)]" },
  ready_to_review: { label: "Ready to review", variant: "warning", dot: "bg-[var(--tt-color-text-yellow)]" },
  completed: { label: "Completed", variant: "success", dot: "bg-[var(--success-100)]" },
  blocked: { label: "Blocked", variant: "danger", dot: "bg-[var(--destructive)]" },
  canceled: { label: "Canceled", variant: "neutral", dot: "bg-[var(--foreground-30)]" }
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: TaskStatus;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const meta = taskStatusMap[status];

  return (
    <Badge variant={meta.variant} className={cn("gap-1.5", className)} {...props}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

