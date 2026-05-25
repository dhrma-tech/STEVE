"use client";

import * as React from "react";
import { Check, Loader2, MessageSquare, Paperclip, Play, ShieldAlert, Square, X } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskDetail } from "@/components/tasks/types";
import { taskStatusOptions, taskTypeLabel } from "@/data/tasks";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function TaskDetailPanel({
  orgId,
  task,
  onTaskChange,
  onLaunchSession
}: {
  orgId: string;
  task: TaskDetail | null;
  onTaskChange: (task: TaskDetail) => void;
  onLaunchSession?: (sessionId: string) => void;
}) {
  const [subtaskTitle, setSubtaskTitle] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [approvalTitle, setApprovalTitle] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    queueMicrotask(() => {
      setError(null);
      setSubtaskTitle("");
      setComment("");
      setApprovalTitle("");
    });
  }, [task?.id]);

  if (!task) {
    return (
      <section className="rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4">
        <EmptyState surface="dark" title="Select a task" description="Task detail, comments, subtasks, files, approvals, and sessions appear here." />
      </section>
    );
  }

  const pendingApprovals = task.approvals.filter((approval) => approval.status === "pending");

  async function mutate<T>({
    key,
    path,
    method = "POST",
    body,
    selectTask
  }: {
    key: string;
    path: string;
    method?: "POST" | "PATCH";
    body?: unknown;
    selectTask: (payload: T) => TaskDetail | null | undefined;
  }) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = (await response.json()) as ApiPayload<T>;
      const nextTask = payload.data ? selectTask(payload.data) : null;
      if (!response.ok || !nextTask) {
        throw new Error(payload.error?.message ?? "Task update failed.");
      }
      onTaskChange(nextTask);
      return payload.data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Task update failed.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    if (!task) return;
    const result = await mutate<{ kind: "started"; session: { id: string }; task: TaskDetail }>({
      key: "start",
      path: `/api/orgs/${orgId}/tasks/${task.id}/start`,
      selectTask: (payload) => payload.task
    });
    if (result?.kind === "started") {
      onLaunchSession?.(result.session.id);
    }
  }

  return (
    <section className="grid gap-4 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{taskTypeLabel(task.type)}</p>
          <h2 className="mt-1 text-xl font-medium tracking-[0px]">{task.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-50)]">{task.description ?? "No description yet."}</p>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {error ? (
        <div className="rounded-[10px] border border-[rgba(239,68,68,0.36)] bg-[rgba(239,68,68,0.08)] p-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : null}

      {pendingApprovals.length ? (
        <div className="grid gap-3 rounded-[10px] border border-[rgba(245,158,11,0.38)] bg-[rgba(245,158,11,0.1)] p-3">
          <div className="flex items-center gap-2 text-[var(--alert)]">
            <ShieldAlert aria-hidden="true" className="size-4" />
            <h3 className="text-sm font-medium">Approval required</h3>
          </div>
          {pendingApprovals.map((approval) => (
            <div key={approval.id} className="grid gap-2">
              <p className="text-sm">{approval.title}</p>
              {approval.description ? <p className="text-xs leading-5 text-[var(--foreground-50)]">{approval.description}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="app"
                  size="sm"
                  disabled={busy === approval.id}
                  onClick={() =>
                    mutate<TaskDetail>({
                      key: approval.id,
                      method: "PATCH",
                      path: `/api/orgs/${orgId}/tasks/${task.id}/approvals/${approval.id}`,
                      body: { status: "approved" },
                      selectTask: (payload) => payload
                    })
                  }
                >
                  <Check aria-hidden="true" className="size-4" />
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy === approval.id}
                  onClick={() =>
                    mutate<TaskDetail>({
                      key: approval.id,
                      method: "PATCH",
                      path: `/api/orgs/${orgId}/tasks/${task.id}/approvals/${approval.id}`,
                      body: { status: "rejected" },
                      selectTask: (payload) => payload
                    })
                  }
                >
                  <X aria-hidden="true" className="size-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          surface="dark"
          label="Status"
          value={task.status}
          onValueChange={(status) =>
            mutate<TaskDetail>({
              key: "status",
              method: "PATCH",
              path: `/api/orgs/${orgId}/tasks/${task.id}`,
              body: { status },
              selectTask: (payload) => payload
            })
          }
          options={taskStatusOptions.map((status) => ({ value: status.value, label: status.label }))}
        />
        <div className="grid content-end">
          <div className="flex flex-wrap gap-2">
            <Button variant="app" size="sm" disabled={busy === "start" || task.status === "completed" || task.status === "canceled"} onClick={start}>
              {busy === "start" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-4" />}
              Start
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]"
              disabled={busy === "cancel" || task.status === "completed" || task.status === "canceled"}
              onClick={() =>
                mutate<TaskDetail>({
                  key: "cancel",
                  path: `/api/orgs/${orgId}/tasks/${task.id}/cancel`,
                  selectTask: (payload) => payload
                })
              }
            >
              <X aria-hidden="true" className="size-4" />
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Subtasks</h3>
          <Badge variant="neutral">{task.completedSubtasks}/{task.subtasksCount}</Badge>
        </div>
        {task.subtasks.length ? (
          <div className="grid gap-2">
            {task.subtasks.map((subtask) => (
              <button
                key={subtask.id}
                type="button"
                className="flex items-center gap-2 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-2 text-left text-sm outline-none hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
                onClick={() =>
                  mutate<TaskDetail>({
                    key: subtask.id,
                    method: "PATCH",
                    path: `/api/orgs/${orgId}/tasks/${task.id}/subtasks/${subtask.id}`,
                    body: { status: subtask.status === "completed" ? "queued" : "completed" },
                    selectTask: (payload) => payload
                  })
                }
              >
                {subtask.status === "completed" ? <Check aria-hidden="true" className="size-4 text-[var(--tt-color-text-green-contrast)]" /> : <Square aria-hidden="true" className="size-4 text-[var(--foreground-50)]" />}
                <span>{subtask.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-50)]">No subtasks</p>
        )}
        <div className="flex gap-2">
          <Input surface="dark" label="New subtask" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} />
          <Button
            variant="app"
            className="self-end"
            disabled={!subtaskTitle.trim() || busy === "subtask"}
            onClick={() =>
              mutate<TaskDetail>({
                key: "subtask",
                path: `/api/orgs/${orgId}/tasks/${task.id}/subtasks`,
                body: { title: subtaskTitle },
                selectTask: (payload) => payload
              }).then((updated) => {
                if (updated) setSubtaskTitle("");
              })
            }
          >
            Add
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <MessageSquare aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Comments</h3>
        </div>
        {task.comments.length ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto">
            {task.comments.map((message) => (
              <div key={message.id} className="rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
                <p className="text-xs text-[var(--foreground-50)]">{message.senderUser?.name ?? message.senderAgent?.name ?? message.senderType}</p>
                <p className="mt-1 text-sm leading-6">{message.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-50)]">No comments</p>
        )}
        <Textarea surface="dark" label="Comment" value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-24" />
        <Button
          variant="app"
          size="sm"
          disabled={!comment.trim() || busy === "comment"}
          onClick={() =>
            mutate<TaskDetail>({
              key: "comment",
              path: `/api/orgs/${orgId}/tasks/${task.id}/comments`,
              body: { body: comment },
              selectTask: (payload) => payload
            }).then((updated) => {
              if (updated) setComment("");
            })
          }
        >
          Add comment
        </Button>
      </div>

      <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <Paperclip aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Attachments</h3>
        </div>
        {task.attachments.length ? (
          <div className="grid gap-2">
            {task.attachments.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-2">
                <span className="truncate text-sm">{file.name}</span>
                <Badge variant="neutral">{file.visibility}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-50)]">No attachments</p>
        )}
        <FileUpload
          label="Attach files"
          maxFiles={6}
          multiple
          onFilesSelected={(files) =>
            mutate<TaskDetail>({
              key: "attachments",
              path: `/api/orgs/${orgId}/tasks/${task.id}/attachments`,
              body: { attachmentNames: files.map((file) => file.name) },
              selectTask: (payload) => payload
            })
          }
        />
      </div>

      <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <ShieldAlert aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Approval request</h3>
        </div>
        <div className="flex gap-2">
          <Input surface="dark" label="Request title" value={approvalTitle} onChange={(event) => setApprovalTitle(event.target.value)} />
          <Button
            variant="app"
            className="self-end"
            disabled={!approvalTitle.trim() || busy === "approval"}
            onClick={() =>
              mutate<TaskDetail>({
                key: "approval",
                path: `/api/orgs/${orgId}/tasks/${task.id}/approvals`,
                body: { title: approvalTitle, riskLevel: "medium" },
                selectTask: (payload) => payload
              }).then((updated) => {
                if (updated) setApprovalTitle("");
              })
            }
          >
            Request
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <h3 className="text-sm font-medium">Sessions</h3>
        {task.sessions.length ? (
          task.sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-2 text-left outline-none hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
              onClick={() => onLaunchSession?.(session.id)}
            >
              <span className="truncate text-sm">{session.id}</span>
              <Badge variant={session.status === "running" ? "running" : session.status === "completed" ? "success" : "neutral"}>{session.status}</Badge>
            </button>
          ))
        ) : (
          <p className="text-xs text-[var(--foreground-50)]">No sessions</p>
        )}
      </div>
    </section>
  );
}
