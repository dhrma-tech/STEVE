"use client";

import { CalendarDays, CheckSquare, MessageCircle, Paperclip, ShieldAlert } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { TaskSummary, TaskWorkspacePayload } from "@/components/tasks/types";
import { taskTypeLabel } from "@/data/tasks";
import { cn } from "@/lib/utils/cn";

export function TaskList({
  tasks,
  selectedTaskId,
  onSelectTask
}: {
  tasks: TaskSummary[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}) {
  if (!tasks.length) {
    return <EmptyState surface="dark" title="No tasks" description="Create a task or launch an available roadmap item." />;
  }

  return (
    <div className="grid gap-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} selected={selectedTaskId === task.id} onSelect={() => onSelectTask(task.id)} />
      ))}
    </div>
  );
}

export function TaskBoard({
  board,
  selectedTaskId,
  onSelectTask
}: {
  board: TaskWorkspacePayload["board"];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {board.map((column) => (
        <section key={column.status} className="grid gap-2 rounded-[12px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{column.label}</h3>
            <Badge variant="neutral">{column.tasks.length}</Badge>
          </div>
          {column.tasks.length ? (
            <div className="grid gap-2">
              {column.tasks.map((task) => (
                <TaskRow compact key={task.id} task={task} selected={selectedTaskId === task.id} onSelect={() => onSelectTask(task.id)} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-xs text-[var(--app-text-50)]">No tasks</p>
          )}
        </section>
      ))}
    </div>
  );
}

export function TaskCalendar({
  calendar,
  selectedTaskId,
  onSelectTask
}: {
  calendar: TaskWorkspacePayload["calendar"];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {calendar.days.map((day) => (
          <section key={day.key} className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">{day.label}</h3>
                <p className="mt-1 text-xs text-[var(--app-text-50)]">{day.date}</p>
              </div>
              <Badge variant={day.tasks.length ? "running" : "neutral"}>{day.tasks.length}</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              {day.tasks.length ? (
                day.tasks.map((task) => (
                  <TaskRow compact key={task.id} task={task} selected={selectedTaskId === task.id} onSelect={() => onSelectTask(task.id)} />
                ))
              ) : (
                <p className="text-xs text-[var(--app-text-50)]">Open</p>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="grid gap-2 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
          <h3 className="text-sm font-medium">Unscheduled</h3>
        </div>
        {calendar.unscheduled.length ? (
          calendar.unscheduled.map((task) => (
            <TaskRow compact key={task.id} task={task} selected={selectedTaskId === task.id} onSelect={() => onSelectTask(task.id)} />
          ))
        ) : (
          <p className="text-xs text-[var(--app-text-50)]">No unscheduled active tasks</p>
        )}
      </section>
    </div>
  );
}

function TaskRow({
  task,
  selected,
  compact = false,
  onSelect
}: {
  task: TaskSummary;
  selected: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid w-full gap-3 rounded-[10px] border p-3 text-left outline-none transition-[background,border-color,transform] animate-[task-row-in_180ms_ease-out] hover:bg-[rgba(255,255,255,0.07)] focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
        selected ? "border-[var(--app-primary-light)] bg-[rgba(255,255,255,0.08)]" : "border-[var(--app-border)] bg-[rgba(255,255,255,0.04)]",
        compact && "gap-2 p-2.5"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{task.title}</h3>
          <p className="mt-1 truncate text-xs text-[var(--app-text-50)]">
            {[task.department?.name, task.agent?.name ?? task.assignedUser?.name, taskTypeLabel(task.type)].filter(Boolean).join(" / ")}
          </p>
        </div>
        <StatusBadge status={task.status} className="shrink-0" />
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-50)]">
          <span>{relativeDate(task.updatedAt)}</span>
          {task.dueAt ? <span>Due {shortDate(task.dueAt)}</span> : null}
          {task.pendingApproval ? (
            <span className="inline-flex items-center gap-1 text-[#ffd27c]">
              <ShieldAlert aria-hidden="true" className="size-3.5" />
              Approval
            </span>
          ) : null}
          {task.subtasksCount ? (
            <span className="inline-flex items-center gap-1">
              <CheckSquare aria-hidden="true" className="size-3.5" />
              {task.completedSubtasks}/{task.subtasksCount}
            </span>
          ) : null}
          {task.commentsCount ? (
            <span className="inline-flex items-center gap-1">
              <MessageCircle aria-hidden="true" className="size-3.5" />
              {task.commentsCount}
            </span>
          ) : null}
          {task.filesCount ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip aria-hidden="true" className="size-3.5" />
              {task.filesCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeDate(value: string) {
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return shortDate(value);
}

