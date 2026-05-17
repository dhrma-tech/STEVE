"use client";

import * as React from "react";
import { RefreshCw, Workflow } from "lucide-react";
import { RoadmapDetailPanel } from "@/components/roadmap/roadmap-detail-panel";
import { RoadmapStageBoard } from "@/components/roadmap/roadmap-stage-board";
import { useRoadmap } from "@/components/roadmap/use-roadmap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { RoadmapData } from "@/lib/roadmap/data";

type RoadmapItem = RoadmapData["stages"][number]["items"][number];
type RoadmapLaunchResponse =
  | { kind: "task_created" | "existing_task"; task: { id: string; title: string; status: string }; item: RoadmapItem; sessionId?: string | null }
  | { kind: "approval_requested"; task: { id: string; title: string; status: string }; approval: { id: string; status: string }; item: RoadmapItem }
  | { kind: "already_complete"; item: RoadmapItem };

export function RoadmapModal({
  orgId,
  open,
  onOpenChange,
  onLaunchSession
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunchSession: (sessionId: string) => void;
}) {
  const roadmapState = useRoadmap(orgId, open);
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState("board");
  const [launchState, setLaunchState] = React.useState<{ itemId: string | null; busy: boolean; message: string | null; error: string | null }>({
    itemId: null,
    busy: false,
    message: null,
    error: null
  });
  const [completingItemId, setCompletingItemId] = React.useState<string | null>(null);

  const roadmap = roadmapState.data;
  const items = React.useMemo(() => roadmap?.stages.flatMap((stage) => stage.items) ?? [], [roadmap]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  async function launchItem(item: RoadmapItem, input: string | null) {
    setLaunchState({ itemId: item.id, busy: true, message: null, error: null });
    const response = await fetch(`/api/orgs/${orgId}/roadmap/items/${item.id}/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input })
    });
    const payload = (await response.json().catch(() => null)) as { data?: RoadmapLaunchResponse; error?: { message?: string; details?: { kind?: string } } } | null;

    if (!response.ok) {
      const details = payload?.error?.details;
      const error = details?.kind === "input_required"
        ? "Add the founder input this item needs, then launch again."
        : payload?.error?.message ?? "Unable to launch roadmap item.";
      setLaunchState({ itemId: item.id, busy: false, message: null, error });
      return;
    }

    const result = payload?.data;
    const message = result?.kind === "approval_requested"
      ? "Approval task created and waiting for review."
      : result?.kind === "existing_task"
        ? "An active task already exists for this roadmap item."
        : result?.kind === "already_complete"
          ? "This roadmap item is already complete."
          : "Roadmap task created.";
    setLaunchState({ itemId: item.id, busy: false, message, error: null });
    roadmapState.reload();

    // Use sessionId returned by the API (not task.id which is wrong)
    if (result && "sessionId" in result && result.sessionId) {
      onOpenChange(false);
      onLaunchSession(result.sessionId);
    }
  }

  async function completeItem(item: RoadmapItem) {
    setCompletingItemId(item.id);
    setLaunchState({ itemId: item.id, busy: false, message: null, error: null });
    const response = await fetch(`/api/orgs/${orgId}/roadmap/items/${item.id}/complete`, { method: "POST" });
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string }; data?: { progress?: { percent: number } } } | null;

    if (!response.ok) {
      setLaunchState({ itemId: item.id, busy: false, message: null, error: payload?.error?.message ?? "Unable to complete roadmap item." });
      setCompletingItemId(null);
      return;
    }

    setLaunchState({ itemId: item.id, busy: false, message: `Completed. Roadmap progress is now ${payload?.data?.progress?.percent ?? 0}%.`, error: null });
    setCompletingItemId(null);
    roadmapState.reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-4 top-4 flex h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[16px] p-0" showClose>
        <DialogHeader className="border-b border-[var(--border-10)] p-4 pr-12">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
                <Workflow aria-hidden="true" className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-2xl">Roadmap tech tree</DialogTitle>
                <DialogDescription>
                  Company-building milestones, dependencies, unlocks, and launch actions.
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                value={mode}
                onValueChange={setMode}
                surface="dark"
                items={[
                  { value: "board", label: "Board" },
                  { value: "dependencies", label: "Dependencies" }
                ]}
              />
              <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={roadmapState.reload}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Refresh
              </Button>
            </div>
          </div>
          {roadmap ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
              <Progress value={roadmap.progress.percent} />
              <p className="font-mono text-xs text-[var(--foreground-50)]">
                {roadmap.progress.complete}/{roadmap.progress.total} complete - {roadmap.progress.available} available - {roadmap.progress.locked} locked
              </p>
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {roadmapState.status === "loading" && !roadmap ? <LoadingState rows={7} label="Loading roadmap" /> : null}
          {roadmapState.status === "error" ? (
            <ErrorState title="Roadmap did not load" description={roadmapState.error} retry={{ onClick: roadmapState.reload }} />
          ) : null}
          {roadmap ? (
            <div className={`grid min-h-0 flex-1 gap-4 ${selectedItem ? "lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]" : ""}`}>
              {/* Board — must have h-full + overflow-hidden so inner scroll works */}
              <div className="flex min-h-0 flex-col overflow-hidden">
                {mode === "board" ? (
                  <RoadmapStageBoard roadmap={roadmap} selectedItemId={selectedItem?.id ?? null} onSelectItem={(item) => setSelectedItemId(item.id)} />
                ) : (
                  <DependencyMatrix roadmap={roadmap} onSelectItem={(item) => setSelectedItemId(item.id)} />
                )}
              </div>
              {selectedItem ? (
                <RoadmapDetailPanel
                  key={selectedItem.id}
                  item={selectedItem}
                  launchState={launchState}
                  completing={completingItemId === selectedItem.id}
                  onLaunch={launchItem}
                  onComplete={completeItem}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DependencyMatrix({ roadmap, onSelectItem }: { roadmap: RoadmapData; onSelectItem: (item: RoadmapItem) => void }) {
  const items = roadmap.stages.flatMap((stage) => stage.items);

  return (
    <div className="grid max-h-full gap-3 overflow-y-auto pr-2">
      {items.filter((item) => item.requiredFirst.length || item.unlocks.length).map((item) => (
        <button
          key={item.id}
          type="button"
          className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3 text-left outline-none transition-colors hover:bg-[var(--foreground-8)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
          onClick={() => onSelectItem(item)}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">{item.title}</h3>
            <span className="font-mono text-[11px] text-[var(--foreground-50)]">
              {item.requiredFirst.length} in / {item.unlocks.length} out
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground-50)]">
            <span>{item.requiredFirst.map((dependency) => dependency.title).join(", ") || "Start"}</span>
            <span aria-hidden="true" className="h-px w-8 border-t border-dashed border-[var(--border-10)]" />
            <span className="text-[var(--foreground-80)]">{item.title}</span>
            <span aria-hidden="true" className="h-px w-8 border-t border-dashed border-[var(--border-10)]" />
            <span>{item.unlocks.map((unlock) => unlock.title).join(", ") || "End"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
