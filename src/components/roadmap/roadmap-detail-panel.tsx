"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, GitBranch, LockKeyhole, Play, ShieldCheck, UserRound } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import type { RoadmapData } from "@/lib/roadmap/data";

type RoadmapItem = RoadmapData["stages"][number]["items"][number];
type LaunchState = {
  itemId: string | null;
  busy: boolean;
  message: string | null;
  error: string | null;
};

export function RoadmapDetailPanel({
  item,
  launchState,
  completing,
  onLaunch,
  onComplete
}: {
  item: RoadmapItem | null;
  launchState: LaunchState;
  completing: boolean;
  onLaunch: (item: RoadmapItem, input: string | null) => void;
  onComplete: (item: RoadmapItem) => void;
}) {
  const [input, setInput] = React.useState("");
  const needsInput = item?.workType === "user";
  const needsApproval = item?.workType === "approval";

  if (!item) {
    return <EmptyState surface="dark" title="Select a roadmap item" description="Choose a milestone card to inspect dependencies, unlocks, and launch options." />;
  }

  const isActionDisabled = item.status !== "available" || launchState.busy;
  const showInput = item.status === "available" && (needsInput || needsApproval);

  return (
    <aside className="grid min-h-0 gap-4 overflow-y-auto rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.045)] p-4 lg:w-[390px] xl:w-[430px]">
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">{item.stage?.name ?? "Roadmap"}</p>
            <h2 className="mt-1 text-2xl font-medium leading-tight tracking-[0px]">{item.title}</h2>
          </div>
          <StatusBadge status={item.status} label={item.statusLabel} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={workTypeVariant(item.workType)}>{item.workTypeLabel}</Badge>
          {item.department ? <Badge variant="neutral">{item.department.name}</Badge> : null}
        </div>
      </div>

      <RoadmapDependencyGraph item={item} />

      <DetailBlock title="What becomes true" body={item.whatBecomesTrue} />
      <DetailBlock title="How to move forward" body={item.howToMoveForward} />

      <DetailList
        title="Required first"
        empty="No required earlier steps."
        items={item.requiredFirst}
      />
      <DetailList
        title="Completing this unlocks"
        empty="No downstream unlocks listed."
        items={item.unlocks}
      />

      {item.tasks.length ? (
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Linked tasks</h3>
          {item.tasks.map((task) => (
            <div key={task.id} className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="truncate text-sm font-medium">{task.title}</h4>
                <Badge variant={task.status === "completed" ? "success" : task.status === "blocked" ? "warning" : "running"}>{task.status}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-[var(--app-text-50)]">{task.agent?.name ?? task.type}</p>
            </div>
          ))}
        </section>
      ) : null}

      {showInput ? (
        <Textarea
          surface="dark"
          label={needsApproval ? "Approval note" : "Founder input"}
          description={needsApproval ? "Describe what should be reviewed before this action proceeds." : "Add the decision, context, or answer this milestone needs."}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={needsApproval ? "Approve after review of provider, cost, and risk..." : "Here is the founder input needed to move forward..."}
        />
      ) : null}

      {launchState.itemId === item.id && launchState.error ? (
        <p role="alert" className="rounded-[10px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] p-3 text-sm leading-6 text-red-100">
          {launchState.error}
        </p>
      ) : null}
      {launchState.itemId === item.id && launchState.message ? (
        <p className="rounded-[10px] border border-[rgba(52,168,83,0.35)] bg-[rgba(52,168,83,0.1)] p-3 text-sm leading-6 text-[#bdf8c9]">
          {launchState.message}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Button
          variant="app"
          disabled={isActionDisabled}
          onClick={() => onLaunch(item, showInput ? input : null)}
        >
          <ActionIcon workType={item.workType} status={item.status} />
          {item.actionLabel}
        </Button>
        <Button
          variant="ghost"
          disabled={item.status === "complete" || item.status === "locked" || completing}
          className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]"
          onClick={() => onComplete(item)}
        >
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Mark complete
        </Button>
      </div>
    </aside>
  );
}

function RoadmapDependencyGraph({ item }: { item: RoadmapItem }) {
  const left = item.requiredFirst.slice(0, 3);
  const right = item.unlocks.slice(0, 3);

  return (
    <section className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
      <div className="flex items-center gap-2">
        <GitBranch aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
        <h3 className="text-sm font-medium">Dependency graph</h3>
      </div>
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <GraphStack label="Required" items={left} empty="Start" />
        <div className="hidden items-center gap-2 text-[var(--app-text-50)] sm:flex">
          <span className="h-px w-8 border-t border-dashed border-[var(--app-border)]" />
          <ArrowRight aria-hidden="true" className="size-4" />
          <span className="h-px w-8 border-t border-dashed border-[var(--app-border)]" />
        </div>
        <GraphStack label="Unlocks" items={right} empty="End" />
      </div>
    </section>
  );
}

function GraphStack({
  label,
  items,
  empty
}: {
  label: string;
  items: Array<{ id: string; title: string; status: string }>;
  empty: string;
}) {
  return (
    <div className="grid gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">{label}</p>
      {items.length ? (
        items.map((entry) => (
          <div key={entry.id} className="rounded-[8px] border border-dashed border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{entry.title}</span>
              <Badge variant={entry.status === "complete" ? "success" : entry.status === "available" ? "brand" : "neutral"}>{entry.status}</Badge>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-[8px] border border-dashed border-[var(--app-border)] bg-[rgba(255,255,255,0.025)] p-2 text-xs text-[var(--app-text-50)]">{empty}</div>
      )}
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3 text-sm leading-6 text-[var(--app-text-50)]">{body}</p>
    </section>
  );
}

function DetailList({
  title,
  empty,
  items
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string; status: string; stage: string | null }>;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length ? (
        <div className="grid gap-2">
          {items.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-medium">{entry.title}</h4>
                <p className="mt-1 truncate text-xs text-[var(--app-text-50)]">{entry.stage ?? "Roadmap"}</p>
              </div>
              <Badge variant={entry.status === "complete" ? "success" : entry.status === "available" ? "brand" : "neutral"}>{entry.status}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3 text-sm text-[var(--app-text-50)]">{empty}</p>
      )}
    </section>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  if (status === "complete") return <Badge variant="success">{label}</Badge>;
  if (status === "available") return <Badge variant="brand">{label}</Badge>;
  return <Badge variant="neutral">{label}</Badge>;
}

function workTypeVariant(workType: string): BadgeVariant {
  if (workType === "approval") return "warning";
  if (workType === "user") return "running";
  return "brand";
}

function ActionIcon({ workType, status }: { workType: string; status: string }) {
  if (status === "locked") return <LockKeyhole aria-hidden="true" className="size-4" />;
  if (workType === "approval") return <ShieldCheck aria-hidden="true" className="size-4" />;
  if (workType === "user") return <UserRound aria-hidden="true" className="size-4" />;
  return <Play aria-hidden="true" className="size-4" />;
}
