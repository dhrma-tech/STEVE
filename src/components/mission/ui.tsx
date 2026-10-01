"use client";

import type { BadgeVariant } from "@/components/ui/badge";

export type ApiPayload<T> = { data?: T; error?: { message?: string } };

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init ? { ...init, headers: { "content-type": "application/json", ...init.headers } } : undefined);
  const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || !payload?.data) throw new Error(payload?.error?.message ?? "Something went wrong.");
  return payload.data;
}

export const cents = (value: number | null | undefined) =>
  value == null ? "—" : value >= 100 ? `$${(value / 100).toFixed(2)}` : `${value < 10 ? value.toFixed(1) : Math.round(value)}¢`;

export function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export const RUN_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  queued: { label: "Queued", variant: "neutral" },
  running: { label: "Running", variant: "running" },
  waiting_approval: { label: "Needs approval", variant: "warning" },
  waiting_children: { label: "Waiting on team", variant: "running" },
  completed: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" }
};

export const KIND_LABEL: Record<string, string> = {
  task: "Task",
  delegation: "Delegated",
  consult: "Question",
  plan: "Planning",
  plan_node: "Plan step",
  review: "Review",
  plan_report: "Report",
  briefing: "Briefing"
};

export const RISK: Record<string, { label: string; variant: BadgeVariant }> = {
  read: { label: "Read", variant: "neutral" },
  write_internal: { label: "Write", variant: "neutral" },
  delegate: { label: "Delegate", variant: "neutral" },
  external_write: { label: "External", variant: "brand" },
  destructive: { label: "Destructive", variant: "danger" },
  external_comms: { label: "Comms", variant: "warning" },
  spend: { label: "Spend", variant: "danger" }
};

export const panelClass =
  "grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 shadow-[var(--shadow-outset-100)]";
