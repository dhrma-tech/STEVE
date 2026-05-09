import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "neutral" | "success" | "running" | "warning" | "danger" | "brand";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.07)] text-[var(--app-text-50)]",
  success: "border-[rgba(52,168,83,0.35)] bg-[rgba(52,168,83,0.14)] text-[#9df0b4]",
  running: "border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.14)] text-[#9bc2ff]",
  warning: "border-[rgba(245,158,11,0.38)] bg-[rgba(245,158,11,0.14)] text-[#ffd27c]",
  danger: "border-[rgba(239,68,68,0.38)] bg-[rgba(239,68,68,0.14)] text-[#ffabab]",
  brand: "border-[rgba(157,138,255,0.38)] bg-[rgba(98,41,255,0.18)] text-[var(--brand-300)]"
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
  queued: { label: "Queued", variant: "neutral", dot: "bg-[var(--app-text-30)]" },
  running: { label: "Running", variant: "running", dot: "bg-[var(--running)]" },
  finished_turn: { label: "Finished turn", variant: "running", dot: "bg-[var(--running)]" },
  ready_to_review: { label: "Ready to review", variant: "warning", dot: "bg-[var(--warning)]" },
  completed: { label: "Completed", variant: "success", dot: "bg-[var(--success)]" },
  blocked: { label: "Blocked", variant: "danger", dot: "bg-[var(--danger)]" },
  canceled: { label: "Canceled", variant: "neutral", dot: "bg-[var(--app-text-30)]" }
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

