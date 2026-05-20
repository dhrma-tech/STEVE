"use client";

import * as React from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, Inbox, Loader2, Pencil, Play, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentDetail, AgentWorkspacePayload } from "@/components/agents/types";
import { agentModelOptions } from "@/data/agents";
import { PermissionModeSelector } from "@/components/agents/permission-mode-selector";
import { PromptTextarea } from "@/components/agents/prompt-textarea";
import { cn } from "@/lib/utils/cn";

type ApiPayload<T> = { data?: T; error?: { message: string } };

type PendingApproval = {
  taskId: string;
  taskTitle: string;
  approval: { id: string; title: string; description: string | null; riskLevel: string; status: string };
};

function riskBadgeClass(level: string): string {
  if (level === "high") return "border-red-400/30 bg-red-400/10 text-red-400";
  if (level === "low") return "border-green-400/30 bg-green-400/10 text-green-400";
  return "border-amber-400/30 bg-amber-400/10 text-amber-400";
}

export function AgentConfigPanel({
  orgId,
  agent,
  catalog,
  onAgentChange,
  onLaunchSession
}: {
  orgId: string;
  agent: AgentDetail | null;
  catalog: AgentWorkspacePayload | null;
  onAgentChange: (agent: AgentDetail) => void;
  onLaunchSession: (sessionId: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [instructions, setInstructions] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [blockedApproval, setBlockedApproval] = React.useState<PendingApproval | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = React.useState(false);
  const [approvalBusy, setApprovalBusy] = React.useState(false);
  const [approvalDone, setApprovalDone] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    departmentId: "",
    model: "claude-sonnet-sandbox",
    prompt: "",
    permissionMode: "review_required",
    inboxAddress: ""
  });

  React.useEffect(() => {
    if (!agent) return;
    queueMicrotask(() => {
      setEditing(false);
      setError(null);
      setInstructions("");
      setForm({
        name: agent.name,
        description: agent.description ?? "",
        departmentId: agent.departmentId,
        model: agent.model ?? "claude-sonnet-sandbox",
        prompt: agent.prompt ?? "",
        permissionMode: agent.permissionMode,
        inboxAddress: agent.inboxAddress ?? ""
      });
    });
  }, [agent]);

  // Detect blocked tasks and fetch pending approval
  React.useEffect(() => {
    setBlockedApproval(null);
    setApprovalDone(false);
    if (!agent) return;
    const blocked = agent.tasks.find((t) => t.status === "blocked");
    if (!blocked) return;
    fetch(`/api/orgs/${orgId}/tasks/${blocked.id}`)
      .then((r) => r.json())
      .then((p: { data?: { approvals?: Array<{ id: string; title: string; description?: string | null; riskLevel: string; status: string }> } }) => {
        const pending = p.data?.approvals?.find((a) => a.status === "pending");
        if (pending) {
          setBlockedApproval({
            taskId: blocked.id,
            taskTitle: blocked.title,
            approval: { id: pending.id, title: pending.title, description: pending.description ?? null, riskLevel: pending.riskLevel, status: pending.status }
          });
        }
      })
      .catch(() => {});
  }, [agent?.id, orgId]);

  // Fix 15 — inline name editing state (must be before if(!agent) guard)
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [nameValue, setNameValue] = React.useState(agent?.name ?? "");
  const [nameSaveState, setNameSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setNameValue(agent?.name ?? ""); setIsEditingName(false); }, [agent?.id]);
  React.useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  if (!agent) {
    return (
      <section className="rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4">
        <EmptyState surface="dark" title="Select an agent" description="Click any agent on the left to see its details and controls." />
      </section>
    );
  }

  const agentId = agent.id;
  const agentNameCurrent = agent.name; // captured for closures — avoids null narrowing issue

  async function handleNameSave() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === agentNameCurrent) { setIsEditingName(false); setNameValue(agentNameCurrent); return; }
    setNameSaveState("saving");
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${agentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      if (!response.ok) throw new Error("Save failed");
      setNameSaveState("saved");
      setTimeout(() => setNameSaveState("idle"), 1500);
      setIsEditingName(false);
    } catch {
      setNameValue(agentNameCurrent);
      setIsEditingName(false);
      setNameSaveState("idle");
      setError("Failed to rename agent — try again");
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); void handleNameSave(); }
    if (e.key === "Escape") { setNameValue(agentNameCurrent); setIsEditingName(false); }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${agentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as ApiPayload<AgentDetail>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Could not save changes.");
      onAgentChange(payload.data);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save changes.");
    } finally {
      setBusy(null);
    }
  }

  async function run(taskId?: string) {
    const key = taskId ? `run:${taskId}` : "run";
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${agentId}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: taskId ?? null, message: instructions.trim() || null })
      });
      const payload = (await response.json()) as ApiPayload<{ kind: "launched"; session: { id: string } }>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Agent could not start.");
      onLaunchSession(payload.data.session.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent could not start.");
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove() {
    if (!blockedApproval) return;
    setApprovalBusy(true);
    try {
      const response = await fetch(`/api/orgs/${orgId}/tasks/${blockedApproval.taskId}/approvals/${blockedApproval.approval.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "approved" })
      });
      if (!response.ok) throw new Error("Approval failed.");
      setApprovalDialogOpen(false);
      setBlockedApproval(null);
      setApprovalDone(true);
      setTimeout(() => setApprovalDone(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approval failed.");
    } finally {
      setApprovalBusy(false);
    }
  }

  async function handleReject() {
    if (!blockedApproval) return;
    setApprovalBusy(true);
    try {
      const response = await fetch(`/api/orgs/${orgId}/tasks/${blockedApproval.taskId}/approvals/${blockedApproval.approval.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "rejected" })
      });
      if (!response.ok) throw new Error("Rejection failed.");
      setBlockedApproval(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rejection failed.");
    } finally {
      setApprovalBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--foreground-40)]">{agent.department.name}</p>
          {/* Fix 15 — inline name edit */}
          <div className="group mt-0.5 flex min-w-0 items-center gap-1.5">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={() => void handleNameSave()}
                  onKeyDown={handleNameKeyDown}
                  maxLength={50}
                  className="min-w-0 w-full border-b border-[var(--primary)] bg-transparent pb-0.5 text-lg font-medium text-[var(--foreground-80)] outline-none"
                />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); void handleNameSave(); }}
                  title="Save name (Enter)"
                  className="shrink-0 text-green-400 hover:text-green-300"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setNameValue(agentNameCurrent); setIsEditingName(false); }}
                  title="Cancel (Esc)"
                  className="shrink-0 text-[var(--foreground-30)] hover:text-[var(--foreground-60)]"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <div
                className="flex cursor-pointer items-center gap-1.5"
                onClick={() => setIsEditingName(true)}
                title="Click to rename"
              >
                <span className="truncate text-lg font-medium text-[var(--foreground-80)]">{agent.name}</span>
                <Pencil className="size-3 shrink-0 text-[var(--foreground-20)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                {nameSaveState === "saved" && (
                  <span className="animate-[fade-in_150ms_ease-out_both] text-xs text-green-400">✓ Saved</span>
                )}
              </div>
            )}
          </div>
          {agent.description ? (
            <p className="mt-1.5 text-sm leading-5 text-[var(--foreground-50)]">{agent.description}</p>
          ) : null}
        </div>
        <Badge variant={agent.status === "running" ? "running" : agent.status === "idle" ? "success" : "warning"}>
          {agent.status}
        </Badge>
      </div>

      {/* Error */}
      {error ? (
        <p className="rounded-[10px] border border-[var(--destructive)] bg-[var(--foreground-3)] p-3 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}

      {/* Approval banner — shown when agent has a blocked task with pending approval */}
      {approvalDone ? (
        <div className="rounded-[10px] border border-green-500/30 bg-green-500/[0.08] p-3 text-sm text-green-400">
          ✅ Approved — agent starting…
        </div>
      ) : blockedApproval ? (
        <div
          className="animate-[attentionUpdateSlideUp_200ms_ease-out] rounded-[10px] border border-amber-500/30 bg-amber-500/[0.06] p-4"
          style={{ borderLeft: "4px solid rgba(245,158,11,0.7)" }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-300">This task requires your approval</p>
              <p className="mt-1 text-xs font-medium text-[var(--foreground-80)]">{blockedApproval.approval.title}</p>
              {blockedApproval.approval.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--foreground-50)]">{blockedApproval.approval.description}</p>
              ) : null}
              <span className={`mt-2.5 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${riskBadgeClass(blockedApproval.approval.riskLevel)}`}>
                {blockedApproval.approval.riskLevel} risk
              </span>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={approvalBusy} onClick={() => void handleReject()}>
              Reject
            </Button>
            <Button
              size="sm"
              className="border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              disabled={approvalBusy}
              onClick={() => setApprovalDialogOpen(true)}
            >
              {approvalBusy ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
              Approve &amp; Run →
            </Button>
          </div>
        </div>
      ) : null}

      {/* Run section */}
      <div className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <p className="text-xs font-medium text-[var(--foreground-50)]">Instructions (optional)</p>
        <Textarea
          surface="dark"
          label=""
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Tell this agent what to work on next…"
          className="min-h-16"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--foreground-70)] hover:bg-[var(--foreground-5)]"
            onClick={() => setEditing((v) => !v)}
          >
            {editing
              ? <><ChevronUp aria-hidden="true" className="size-3.5" />Close settings</>
              : <><ChevronDown aria-hidden="true" className="size-3.5" />Settings</>}
          </Button>
          <Button
            variant="app"
            size="sm"
            title="Run this agent"
            onClick={() => void run()}
            disabled={busy === "run"}
          >
            {busy === "run"
              ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              : <Play aria-hidden="true" className="size-4" />}
            Run agent
          </Button>
        </div>
      </div>

      {/* Settings (collapsible) */}
      {editing ? (
        <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
          <p className="text-xs font-medium text-[var(--foreground-50)]">Agent settings</p>
          <Input surface="dark" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input surface="dark" label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              surface="dark"
              label="Department"
              value={form.departmentId}
              onValueChange={(v) => setForm({ ...form, departmentId: v })}
              options={catalog?.departments.map((d) => ({ value: d.id, label: d.name })) ?? []}
            />
            <SelectField
              surface="dark"
              label="AI model"
              value={form.model}
              onValueChange={(v) => setForm({ ...form, model: v })}
              options={agentModelOptions}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Approval mode</p>
            <PermissionModeSelector value={form.permissionMode} onChange={(v) => setForm({ ...form, permissionMode: v })} />
          </div>
          <Input
            surface="dark"
            label="Email inbox"
            value={form.inboxAddress}
            onChange={(e) => setForm({ ...form, inboxAddress: e.target.value })}
            placeholder="agent@yourcompany.com"
          />
          <PromptTextarea
            label="Custom instructions"
            value={form.prompt}
            onChange={(v) => setForm({ ...form, prompt: v })}
            departmentSlug={agent.department.slug}
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-[var(--foreground-70)]" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button variant="app" size="sm" onClick={save} disabled={busy === "save"}>
              {busy === "save" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
              Save changes
            </Button>
          </div>
        </div>
      ) : null}

      {/* Email inbox */}
      <div className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <Inbox aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Email inbox</h3>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] px-3 py-2 text-sm">
          <span className="truncate text-[var(--foreground-70)]">{agent.inboxAddress ?? "No email address set"}</span>
          {agent.inboxAddress ? (
            <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={() => navigator.clipboard?.writeText(agent.inboxAddress!)}>
              <Copy aria-hidden="true" className="size-4" />
              Copy
            </Button>
          ) : null}
        </div>
      </div>

      {/* Recent runs */}
      <div className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <h3 className="text-sm font-medium">Recent runs</h3>
        {agent.sessions.length ? (
          <div className="grid gap-1.5">
            {agent.sessions.map((session, index) => (
              <button
                key={session.id}
                type="button"
                className="animate-[newTaskAppear_200ms_ease-out_both] flex items-center gap-2.5 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] px-3 py-2 text-left outline-none hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => onLaunchSession(session.id)}
              >
                {/* Status dot */}
                <span className={cn(
                  "size-2 shrink-0 rounded-full",
                  session.status === "completed" ? "bg-green-400" :
                  session.status === "failed" ? "bg-red-400" :
                  session.status === "running" ? "animate-[pulse-dot_1.5s_ease-in-out_infinite] bg-[var(--primary)]" :
                  "bg-amber-400"
                )} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{session.task?.title ?? "Untitled run"}</span>
                  <span className="mt-0.5 block text-xs text-[var(--foreground-50)]">
                    {formatMs(session.elapsedMs)}
                    {session.createdAt ? ` · ${formatRelativeSessionTime(session.createdAt)}` : ""}
                  </span>
                </span>
                <Badge variant={session.status === "running" ? "running" : session.status === "completed" ? "success" : "neutral"}>
                  {session.status}
                </Badge>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[var(--foreground-50)]">
          <Play aria-hidden="true" className="size-3.5 shrink-0 opacity-50" />
          <p className="text-xs">No sessions yet — click "Run agent" above to start.</p>
        </div>
        )}
      </div>

      {/* Tasks */}
      {agent.tasks.length > 0 ? (
        <div className="grid gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
          <h3 className="text-sm font-medium">Tasks</h3>
          <div className="grid gap-2">
            {agent.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{task.title}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={task.status === "running" ? "running" : task.status === "completed" ? "success" : "neutral"}>
                    {task.status.replace("_", " ")}
                  </Badge>
                  <Button variant="app" size="sm" title="Run this task" disabled={busy === `run:${task.id}`} onClick={() => void run(task.id)}>
                    {busy === `run:${task.id}` ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Play aria-hidden="true" className="size-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Approval confirmation dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Approve this task?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-[var(--foreground-80)]">{blockedApproval?.taskTitle}</span> will be handed to the agent immediately after approval. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {blockedApproval ? (
            <span className={`inline-flex w-fit rounded border px-2 py-0.5 text-xs font-medium ${riskBadgeClass(blockedApproval.approval.riskLevel)}`}>
              {blockedApproval.approval.riskLevel} risk
            </span>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApprovalDialogOpen(false)} disabled={approvalBusy}>
              Cancel
            </Button>
            <Button
              className="border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              onClick={() => void handleApprove()}
              disabled={approvalBusy}
            >
              {approvalBusy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              Yes, Approve &amp; Run →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );
}

function formatMs(value: number) {
  const seconds = Math.max(1, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function formatRelativeSessionTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
