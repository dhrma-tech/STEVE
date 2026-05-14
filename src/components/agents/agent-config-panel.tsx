"use client";

import * as React from "react";
import { Copy, Inbox, Loader2, Play, Save, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentDetail, AgentWorkspacePayload } from "@/components/agents/types";
import { agentModelOptions, agentStatusOptions, permissionModeOptions } from "@/data/agents";

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
  const [launchMessage, setLaunchMessage] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    departmentId: "",
    status: "idle",
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
      setLaunchMessage("");
      setForm({
        name: agent.name,
        description: agent.description ?? "",
        departmentId: agent.departmentId,
        status: agent.status,
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
        <EmptyState surface="dark" title="Select an agent" description="Agent configuration, inbox, tasks, sessions, and launch controls appear here." />
      </section>
    );
  }

  const currentAgent = agent;

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${currentAgent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as ApiPayload<AgentDetail>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Agent could not be saved.");
      onAgentChange(payload.data);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function launch(taskId?: string) {
    setBusy(taskId ? `launch:${taskId}` : "launch");
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${currentAgent.id}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: taskId ?? null, message: launchMessage || `Start ${currentAgent.name}` })
      });
      const payload = (await response.json()) as ApiPayload<{ kind: "launched"; session: { id: string } }>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Agent could not launch.");
      onLaunchSession(payload.data.session.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent could not launch.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-4 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{agent.department.name}</p>
          <h2 className="mt-1 text-xl font-medium tracking-[0px]">{agent.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-50)]">{agent.description ?? "No description set."}</p>
        </div>
        <Badge variant={agent.status === "running" ? "running" : agent.status === "idle" ? "success" : "warning"}>{agent.status}</Badge>
      </div>

      {error ? (
        <div className="rounded-[10px] border border-[var(--tt-color-text-red-contrast)] bg-[var(--tt-color-text-red-contrast)] p-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="app" size="sm" onClick={() => launch()} disabled={busy === "launch"}>
          {busy === "launch" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-4" />}
          Launch session
        </Button>
        <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={() => setEditing((value) => !value)}>
          {editing ? "Close config" : "Edit config"}
        </Button>
      </div>

      <Textarea
        surface="dark"
        label="Launch message"
        value={launchMessage}
        onChange={(event) => setLaunchMessage(event.target.value)}
        className="min-h-24"
        placeholder="Tell this agent what to do next."
      />

      {editing ? (
        <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
          <Input surface="dark" label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input surface="dark" label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField surface="dark" label="Department" value={form.departmentId} onValueChange={(departmentId) => setForm({ ...form, departmentId })} options={catalog?.departments.map((department) => ({ value: department.id, label: department.name })) ?? []} />
            <SelectField surface="dark" label="Status" value={form.status} onValueChange={(status) => setForm({ ...form, status })} options={agentStatusOptions} />
            <SelectField surface="dark" label="Model" value={form.model} onValueChange={(model) => setForm({ ...form, model })} options={agentModelOptions} />
            <SelectField surface="dark" label="Permissions" value={form.permissionMode} onValueChange={(permissionMode) => setForm({ ...form, permissionMode })} options={permissionModeOptions} />
          </div>
          <Input surface="dark" label="Inbox address" value={form.inboxAddress} onChange={(event) => setForm({ ...form, inboxAddress: event.target.value })} />
          <Textarea surface="dark" label="Prompt personalization" value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} className="min-h-32" />
          <Button variant="app" size="sm" onClick={save} disabled={busy === "save"}>
            {busy === "save" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
            Save config
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <Inbox aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Inbox</h3>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-2 text-sm">
          <span className="truncate">{agent.inboxAddress ?? "No inbox address"}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]"
            onClick={() => agent.inboxAddress && navigator.clipboard?.writeText(agent.inboxAddress)}
          >
            <Copy aria-hidden="true" className="size-4" />
            Copy
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <div className="flex items-center gap-2">
          <TerminalSquare aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
          <h3 className="text-sm font-medium">Recent sessions</h3>
        </div>
        {agent.sessions.length ? (
          <div className="grid gap-2">
            {agent.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-2 text-left outline-none hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
                onClick={() => onLaunchSession(session.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{session.task?.title ?? session.id}</span>
                  <span className="mt-1 block text-xs text-[var(--foreground-50)]">{formatMs(session.elapsedMs)}</span>
                </span>
                <Badge variant={session.status === "running" ? "running" : session.status === "completed" ? "success" : "neutral"}>{session.status}</Badge>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-50)]">No sessions yet</p>
        )}
      </div>

      <div className="grid gap-3 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <h3 className="text-sm font-medium">Agent tasks</h3>
        {agent.tasks.length ? (
          <div className="grid gap-2">
            {agent.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{task.title}</span>
                  <span className="mt-1 block text-xs text-[var(--foreground-50)]">{task.type}</span>
                </span>
                <div className="flex gap-2">
                  <Badge variant={task.status === "running" ? "running" : task.status === "completed" ? "success" : "neutral"}>{task.status}</Badge>
                  <Button variant="app" size="sm" disabled={busy === `launch:${task.id}`} onClick={() => launch(task.id)}>
                    <Play aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--foreground-50)]">No assigned tasks</p>
        )}
      </div>
    </section>
  );
}

function formatMs(value: number) {
  const seconds = Math.max(1, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}
