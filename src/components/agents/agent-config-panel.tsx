"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Copy, Inbox, Loader2, Play, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentDetail, AgentWorkspacePayload } from "@/components/agents/types";
import { agentModelOptions, permissionModeOptions } from "@/data/agents";

type ApiPayload<T> = { data?: T; error?: { message: string } };

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

  if (!agent) {
    return (
      <section className="rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4">
        <EmptyState surface="dark" title="Select an agent" description="Click any agent on the left to see its details and controls." />
      </section>
    );
  }

  const agentId = agent.id;

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

  return (
    <section className="grid gap-4 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--foreground-40)]">{agent.department.name}</p>
          <h2 className="mt-0.5 text-lg font-medium">{agent.name}</h2>
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
          <SelectField
            surface="dark"
            label="Approval mode"
            value={form.permissionMode}
            onValueChange={(v) => setForm({ ...form, permissionMode: v })}
            options={permissionModeOptions}
          />
          <Input
            surface="dark"
            label="Email inbox"
            value={form.inboxAddress}
            onChange={(e) => setForm({ ...form, inboxAddress: e.target.value })}
            placeholder="agent@yourcompany.com"
          />
          <Textarea
            surface="dark"
            label="Custom instructions"
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            placeholder="Describe this agent's role, style, or constraints…"
            className="min-h-24"
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
          <div className="grid gap-2">
            {agent.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] px-3 py-2 text-left outline-none hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
                onClick={() => onLaunchSession(session.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{session.task?.title ?? "Untitled run"}</span>
                  <span className="mt-0.5 block text-xs text-[var(--foreground-50)]">{formatMs(session.elapsedMs)}</span>
                </span>
                <Badge variant={session.status === "running" ? "running" : session.status === "completed" ? "success" : "neutral"}>
                  {session.status}
                </Badge>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-50)]">No runs yet — click "Run agent" to start.</p>
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
                  <Button variant="app" size="sm" disabled={busy === `run:${task.id}`} onClick={() => void run(task.id)}>
                    {busy === `run:${task.id}` ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Play aria-hidden="true" className="size-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

    </section>
  );
}

function formatMs(value: number) {
  const seconds = Math.max(1, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}
