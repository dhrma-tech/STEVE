"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import type { MissionOverview, RunNode } from "@/lib/mission/data";
import { RunDetailPanel } from "./run-detail";
import { cents, duration, KIND_LABEL, panelClass, RUN_STATUS } from "./ui";

const PLAN_STATUS: Record<string, string> = {
  drafting: "Planning",
  proposed: "Needs review",
  running: "Running",
  replanning: "Replanning",
  reporting: "Writing report",
  completed: "Done",
  failed: "Stopped",
  cancelled: "Cancelled"
};

function TreeRow({ node, depth, selectedId, onSelect }: { node: RunNode; depth: number; selectedId: string | null; onSelect: (runId: string) => void }) {
  const [open, setOpen] = React.useState(true);
  const status = RUN_STATUS[node.status] ?? { label: node.status, variant: "neutral" as const };
  const active = !["completed", "failed", "cancelled"].includes(node.status);
  return (
    <li>
      <div
        className={`flex items-center gap-2 rounded-[8px] px-2 py-1.5 ${selectedId === node.runId ? "bg-[var(--foreground-8)]" : "hover:bg-[var(--foreground-5)]"}`}
        style={{ paddingLeft: `${8 + depth * 18}px` }}
      >
        {node.children.length ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            onClick={() => setOpen((value) => !value)}
            className="grid size-5 place-items-center rounded text-[var(--foreground-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
          >
            {open ? <ChevronDown aria-hidden="true" className="size-3.5" /> : <ChevronRight aria-hidden="true" className="size-3.5" />}
          </button>
        ) : (
          <span className="size-5" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.runId)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
        >
          {active ? <span className="animate-agent-pulse size-1.5 shrink-0 rounded-full bg-[var(--running)]" aria-hidden="true" /> : null}
          <span className="shrink-0 text-sm font-medium">{node.agent?.name ?? "Agent"}</span>
          <span className="min-w-0 truncate text-xs text-[var(--foreground-50)]">
            {KIND_LABEL[node.kind] ?? node.kind} · {node.summary ?? node.request}
          </span>
        </button>
        {node.pendingApprovals ? <Badge variant="warning">{node.pendingApprovals} to approve</Badge> : null}
        <Badge variant={status.variant}>{status.label}</Badge>
        <span className="w-16 shrink-0 text-right text-[11px] text-[var(--foreground-50)]">{cents(node.costCents)}</span>
        <span className="hidden w-16 shrink-0 text-right text-[11px] text-[var(--foreground-50)] sm:inline">{duration(node.elapsedMs)}</span>
      </div>
      {open && node.children.length ? (
        <ul>
          {node.children.map((child) => (
            <TreeRow key={child.runId} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function LiveView({ orgId, overview, onChanged }: { orgId: string; overview: MissionOverview; onChanged: () => void }) {
  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        {overview.plans.length ? (
          <section className={panelClass}>
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <GitBranch aria-hidden="true" className="size-4" />
              Plans
            </h3>
            {overview.plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/org/${orgId}/canvas?plan=${plan.id}`}
                className="grid gap-1.5 rounded-[8px] p-2 hover:bg-[var(--foreground-5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{plan.goal}</span>
                  <Badge variant={plan.status === "proposed" ? "warning" : plan.status === "completed" ? "success" : plan.status === "failed" ? "danger" : "running"}>
                    {PLAN_STATUS[plan.status] ?? plan.status}
                  </Badge>
                </span>
                {plan.steps ? (
                  <span className="flex items-center gap-2">
                    <Progress value={Math.round((plan.done / plan.steps) * 100)} aria-label={`${plan.goal} progress`} className="flex-1" />
                    <span className="text-[11px] text-[var(--foreground-50)]">
                      {plan.done}/{plan.steps}
                      {plan.running ? ` · ${plan.running} running` : ""}
                    </span>
                  </span>
                ) : null}
              </Link>
            ))}
          </section>
        ) : null}

        <section className={panelClass}>
          <h3 className="text-sm font-medium">Runs (live and last 24 hours)</h3>
          {overview.trees.length === 0 ? (
            <EmptyState surface="dark" title="No agent work yet" description="Give the Chief of Staff a goal above, or launch an agent from the canvas." />
          ) : (
            <ul className="grid gap-0.5">
              {overview.trees.map((tree) => (
                <TreeRow key={tree.runId} node={tree} depth={0} selectedId={selected} onSelect={setSelected} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid content-start gap-4">
        {selected ? (
          <RunDetailPanel key={selected} orgId={orgId} runId={selected} onClose={() => setSelected(null)} onChanged={onChanged} />
        ) : (
          <p className="rounded-[12px] border border-dashed border-[var(--border-10)] p-6 text-center text-sm text-[var(--foreground-50)]">
            Select a run to see what it did, step by step, and replay it.
          </p>
        )}
      </div>
    </div>
  );
}
