"use client";

import * as React from "react";
import { Archive, Filter, ListTodo, Plus, RefreshCw, RotateCcw, Search, Sparkles } from "lucide-react";
import { TaskBoard, TaskCalendar, TaskList } from "@/components/tasks/task-cards";
import { TaskCreateDialog, type TaskCreateDefaults } from "@/components/tasks/task-create-dialog";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import type { TaskDetail, TaskWorkspacePayload } from "@/components/tasks/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select";
import { appTargetOptions, taskStatusOptions, taskTypeOptions, taskViewOptions, type TaskViewValue } from "@/data/tasks";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function TaskWorkspace({
  orgId,
  initialView = "list",
  initialTaskId = null,
  compact = false,
  onLaunchSession
}: {
  orgId: string;
  initialView?: TaskViewValue;
  initialTaskId?: string | null;
  compact?: boolean;
  onLaunchSession?: (sessionId: string) => void;
}) {
  const [view, setView] = React.useState<TaskViewValue>(initialView);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [departmentId, setDepartmentId] = React.useState("all");
  const [assigneeId, setAssigneeId] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [data, setData] = React.useState<TaskWorkspacePayload | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(initialTaskId);
  const [selectedTask, setSelectedTask] = React.useState<TaskDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDefaults, setCreateDefaults] = React.useState<TaskCreateDefaults | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshIndex((index) => index + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("view", view);
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    if (departmentId !== "all") params.set("departmentId", departmentId);
    if (assigneeId !== "all") params.set("assigneeId", assigneeId);
    if (type !== "all") params.set("type", type);

    queueMicrotask(() => setLoading(true));
    fetch(`/api/orgs/${orgId}/tasks?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<TaskWorkspacePayload>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Tasks did not load.");
        setData(payload.data);
        setError(null);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(caught instanceof Error ? caught.message : "Tasks did not load.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [assigneeId, departmentId, orgId, query, refreshIndex, status, type, view]);

  React.useEffect(() => {
    if (!selectedTaskId) {
      queueMicrotask(() => setSelectedTask(null));
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => setDetailLoading(true));
    fetch(`/api/orgs/${orgId}/tasks/${selectedTaskId}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<TaskDetail>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Task detail did not load.");
        setSelectedTask(payload.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSelectedTask(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => controller.abort();
  }, [orgId, selectedTaskId]);

  function updateTask(nextTask: TaskDetail) {
    setSelectedTask(nextTask);
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        tasks: current.tasks.map((task) => (task.id === nextTask.id ? { ...task, ...summaryFromDetail(nextTask) } : task)),
        board: current.board.map((column) => ({
          ...column,
          tasks: column.tasks
            .filter((task) => task.id !== nextTask.id)
            .concat(nextTask.status === column.status ? [{ ...summaryFromDetail(nextTask) }] : [])
        }))
      };
    });
  }

  async function launchSuggested(item: TaskWorkspacePayload["suggestedTasks"][number]) {
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/roadmap/items/${item.id}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as ApiPayload<
        | { kind: "task_created" | "existing_task"; task: { id: string } }
        | { kind: "approval_requested"; task: { id: string } }
      >;

      if (!response.ok || !payload.data) {
        setCreateDefaults({
          title: item.title,
          description: `${item.stage} roadmap item.`,
          departmentId: item.department?.id ?? null,
          type: item.workType === "approval" ? "approval_task" : item.workType === "user" ? "user_task" : "agent_task",
          source: "suggested_next",
          roadmapItemId: item.id
        });
        setCreateOpen(true);
        return;
      }

      setSelectedTaskId(payload.data.task.id);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suggested task could not launch.");
    }
  }

  const statusOptions = React.useMemo(
    () => [{ value: "all", label: "All statuses" }, ...taskStatusOptions.map((option) => ({ value: option.value, label: option.label }))],
    []
  );
  const departmentOptions = React.useMemo(
    () => [{ value: "all", label: "All departments" }, ...(data?.catalog.departments.map((department) => ({ value: department.id, label: department.name })) ?? [])],
    [data]
  );
  const assigneeOptions = React.useMemo(
    () => [{ value: "all", label: "All assignees" }, ...(data?.catalog.members.map((member) => ({ value: member.id, label: member.name })) ?? [])],
    [data]
  );
  const typeOptions = React.useMemo(
    () => [{ value: "all", label: "All types" }, ...taskTypeOptions.map((option) => ({ value: option.value, label: option.label }))],
    []
  );

  // ── Compact mode (canvas side panel) ─────────────────────────────────────
  if (compact) {
    const ACTIVE = new Set(["running", "pending", "in_progress", "ready_to_review", "blocked", "queued", "waiting"]);
    const activeTasks = data?.tasks.filter((t) => ACTIVE.has(t.status)) ?? [];

    return (
      <div className="flex min-h-0 flex-col gap-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--foreground-40)]">
              <circle cx="3" cy="3" r="1.5" fill="currentColor" />
              <circle cx="8" cy="3" r="1.5" fill="currentColor" />
              <circle cx="13" cy="3" r="1.5" fill="currentColor" />
              <circle cx="3" cy="8" r="1.5" fill="currentColor" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="13" cy="8" r="1.5" fill="currentColor" />
              <circle cx="3" cy="13" r="1.5" fill="currentColor" />
              <circle cx="8" cy="13" r="1.5" fill="currentColor" />
              <circle cx="13" cy="13" r="1.5" fill="currentColor" />
            </svg>
            <h2 className="text-base font-semibold tracking-[-0.2px] text-[var(--foreground)]">Tasks</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Archive" className="grid size-7 place-items-center rounded-[7px] border border-[var(--border-10)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)]">
              <Archive aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setCreateDefaults(null); setCreateOpen(true); }}
              className="flex items-center gap-1 rounded-[8px] bg-[var(--foreground)] px-3 py-1.5 text-xs font-semibold text-[var(--background)] transition-colors hover:opacity-90"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              New task
            </button>
          </div>
        </div>

        {/* Select all */}
        <div className="flex items-center gap-2.5 border-b border-[var(--border-10)] py-2">
          <input type="checkbox" aria-label="Select all" className="size-3.5 shrink-0 cursor-pointer rounded accent-[var(--foreground)]" />
          <span className="text-sm text-[var(--foreground-50)]">Select all</span>
        </div>

        {error ? <ErrorState title="Tasks did not load" description={error} retry={{ onClick: refresh }} /> : null}
        {loading ? <LoadingState rows={4} label="Loading tasks" /> : null}

        {!loading && data ? (
          <>
            {/* Active tasks */}
            {activeTasks.length > 0 ? (
              <section>
                <p className="py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-40)]">
                  Active tasks
                </p>
                <div>
                  {activeTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                      className="flex w-full items-center gap-3 border-b border-[var(--border-10)] py-2.5 text-left transition-colors hover:bg-[var(--foreground-3)]"
                    >
                      <input type="checkbox" className="size-3.5 shrink-0 cursor-pointer rounded accent-[var(--foreground)]" onClick={(e) => e.stopPropagation()} readOnly />
                      <span className={`size-2 shrink-0 rounded-full ${taskDotColor(task.status)}`} />
                      {task.type === "agent_task" ? (
                        <Sparkles aria-hidden="true" className="size-3.5 shrink-0 text-[var(--foreground-40)]" />
                      ) : (
                        <ListTodo aria-hidden="true" className="size-3.5 shrink-0 text-[var(--foreground-40)]" />
                      )}
                      <span className="flex-1 truncate text-sm text-[var(--foreground-80)]">{task.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[var(--foreground-40)]">{timeAgo(task.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Suggested next */}
            {data.suggestedTasks.length > 0 ? (
              <section>
                <div className="flex items-center justify-between py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-40)]">Suggested next</p>
                  <button type="button" onClick={refresh} aria-label="Refresh suggestions" className="text-[var(--foreground-40)] transition-colors hover:text-[var(--foreground-80)]">
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
                <div>
                  {data.suggestedTasks.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 border-b border-[var(--border-10)] py-2.5 transition-colors hover:bg-[var(--foreground-3)]"
                    >
                      <RotateCcw aria-hidden="true" className="size-3.5 shrink-0 text-[var(--foreground-30)]" />
                      <span className="flex-1 truncate text-sm text-[var(--foreground-70)]">{item.title}</span>
                      <button
                        type="button"
                        onClick={() => launchSuggested(item)}
                        disabled={item.status === "locked"}
                        className="hidden shrink-0 rounded-full border border-[var(--border-10)] px-2 py-0.5 text-[11px] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)] group-hover:inline-block disabled:opacity-40"
                      >
                        Mark complete
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTasks.length === 0 && data.suggestedTasks.length === 0 ? (
              <EmptyState surface="dark" title="No tasks yet" description="Create a task or let the roadmap suggest one." />
            ) : null}
          </>
        ) : null}

        <TaskCreateDialog
          orgId={orgId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaults={createDefaults}
          catalog={data?.catalog ?? null}
          onCreated={(task) => { setSelectedTaskId(task.id); setSelectedTask(task); refresh(); }}
        />
      </div>
    );
  }

  // ── Full mode ──────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
            <ListTodo aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Tasks</p>
            <h2 className="text-lg font-medium tracking-[0px]">Tasks</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={refresh}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <Button
            variant="app"
            size="sm"
            onClick={() => {
              setCreateDefaults(null);
              setCreateOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            New task
          </Button>
        </div>
      </div>

      <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Suggested next</h3>
        </div>
        {data?.suggestedTasks.length ? (
          <div className="grid gap-2">
            {data.suggestedTasks.slice(0, compact ? 3 : 6).map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3 text-left outline-none transition-colors hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] disabled:opacity-50"
                disabled={item.status === "locked"}
                onClick={() => launchSuggested(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="mt-1 block truncate text-xs text-[var(--foreground-50)]">{item.stage} / {item.department?.name ?? appTargetOptions[0].label}</span>
                </span>
                <Badge variant={item.status === "available" ? "running" : "neutral"}>{item.workType}</Badge>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState surface="dark" title="No suggested tasks" description="Roadmap suggestions will appear as items unlock." />
        )}
      </section>

      <div className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <Filter aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Filters</h3>
        </div>
        <Input 
          surface="dark" 
          label="Search" 
          startIcon={<Search aria-hidden="true" className="size-4" />} 
          value={query} 
          onChange={(event) => setQuery(event.target.value)} 
        />
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField surface="dark" label="Status" value={status} onValueChange={setStatus} options={statusOptions} />
          <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} />
          <SelectField surface="dark" label="Assignee" value={assigneeId} onValueChange={setAssigneeId} options={assigneeOptions} />
          <SelectField surface="dark" label="Type" value={type} onValueChange={setType} options={typeOptions} />
        </div>
      </div>

      <SegmentedControl value={view} onValueChange={(next) => setView(next as TaskViewValue)} surface="dark" items={taskViewOptions} />

      {error ? <ErrorState title="Tasks did not load" description={error} retry={{ onClick: refresh }} /> : null}
      {loading ? <LoadingState rows={5} label="Loading tasks" /> : null}
      {!loading && data ? (
        <>
          {view === "list" ? <TaskList tasks={data.tasks} selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} /> : null}
          {view === "board" ? <TaskBoard board={data.board} selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} /> : null}
          {view === "calendar" ? <TaskCalendar calendar={data.calendar} selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} /> : null}
        </>
      ) : null}

      {detailLoading ? <LoadingState rows={4} label="Loading task detail" /> : <TaskDetailPanel orgId={orgId} task={selectedTask} onTaskChange={updateTask} onLaunchSession={onLaunchSession} />}

      <TaskCreateDialog
        orgId={orgId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaults={createDefaults}
        catalog={data?.catalog ?? null}
        onCreated={(task) => {
          setSelectedTaskId(task.id);
          setSelectedTask(task);
          refresh();
        }}
      />
    </div>
  );
}

function taskDotColor(status: string): string {
  if (status === "running") return "bg-blue-400";
  if (status === "completed") return "bg-green-400";
  if (status === "ready_to_review") return "bg-yellow-400";
  if (status === "blocked") return "bg-red-400";
  return "bg-[var(--foreground-30)]";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function summaryFromDetail(task: TaskDetail): TaskWorkspacePayload["tasks"][number] {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    metadata: task.metadata,
    department: task.department,
    agent: task.agent,
    roadmapItem: task.roadmapItem,
    createdBy: task.createdBy,
    assignedUser: task.assignedUser,
    subtasksCount: task.subtasksCount,
    completedSubtasks: task.completedSubtasks,
    commentsCount: task.comments.length,
    filesCount: task.attachments.length,
    approvalsCount: task.approvals.length,
    pendingApproval: task.approvals.find((approval) => approval.status === "pending") ?? null,
    latestSession: task.sessions[0] ?? null
  };
}
