"use client";

import * as React from "react";
import { ArrowLeft, Cpu, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { AgentList, MarketplaceSkills } from "@/components/agents/agent-cards";
import { AgentConfigPanel } from "@/components/agents/agent-config-panel";
import { AgentCreateDialog } from "@/components/agents/agent-create-dialog";
import type { AgentDetail, AgentWorkspacePayload } from "@/components/agents/types";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { SelectField } from "@/components/ui/select";
import { agentStatusOptions } from "@/data/agents";

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function AgentControlCenter({
  orgId,
  initialAgentId = null,
  orgName,
  compact = false,
  onLaunchSession
}: {
  orgId: string;
  initialAgentId?: string | null;
  orgName?: string;
  compact?: boolean;
  onLaunchSession: (sessionId: string) => void;
}) {
  const [data, setData] = React.useState<AgentWorkspacePayload | null>(null);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(initialAgentId);
  const [selectedAgent, setSelectedAgent] = React.useState<AgentDetail | null>(null);
  const [departmentId, setDepartmentId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshIndex((index) => index + 1), []);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (departmentId !== "all") params.set("departmentId", departmentId);
    if (status !== "all") params.set("status", status);
    if (query.trim()) params.set("q", query.trim());

    queueMicrotask(() => setLoading(true));
    fetch(`/api/orgs/${orgId}/agents?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<AgentWorkspacePayload>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Agents did not load.");
        setData(payload.data);
        setError(null);
        if (!selectedAgentId && payload.data.agents[0]) {
          setSelectedAgentId(payload.data.agents[0].id);
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(caught instanceof Error ? caught.message : "Agents did not load.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [departmentId, orgId, query, refreshIndex, selectedAgentId, status]);

  React.useEffect(() => {
    if (!selectedAgentId) {
      queueMicrotask(() => setSelectedAgent(null));
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => setDetailLoading(true));
    fetch(`/api/orgs/${orgId}/agents/${selectedAgentId}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<ApiPayload<AgentDetail>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Agent detail did not load.");
        setSelectedAgent(payload.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSelectedAgent(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => controller.abort();
  }, [orgId, selectedAgentId]);

  const [activating, setActivating] = React.useState(false);

  async function activateDepartments() {
    setActivating(true);
    try {
      await fetch(`/api/orgs/${orgId}/activate-departments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      refresh();
    } catch { /* ignore */ }
    finally { setActivating(false); }
  }

  const [launchingId, setLaunchingId] = React.useState<string | null>(null);

  async function launchAgent(agentId: string) {
    setLaunchingId(agentId);
    setError(null);
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${agentId}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: null })
      });
      const payload = (await response.json()) as ApiPayload<{ kind: "launched"; session: { id: string } }>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Agent could not start.");
      onLaunchSession(payload.data.session.id);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent could not start.");
    } finally {
      setLaunchingId(null);
    }
  }

  const departmentOptions = React.useMemo(
    () => [{ value: "all", label: "All departments" }, ...(data?.departments.map((department) => ({ value: department.id, label: department.name })) ?? [])],
    [data]
  );
  const statusOptions = React.useMemo(
    () => [{ value: "all", label: "All statuses" }, ...agentStatusOptions.map((option) => ({ value: option.value, label: option.label }))],
    []
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
            <Cpu aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Company</p>
            <h2 className="text-lg font-medium tracking-[0px]">{orgName ?? "Your agents"}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={refresh}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <Button variant="app" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            New Agent
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
        <Input
          surface="dark"
          label="Search agents"
          startIcon={<Search aria-hidden="true" className="size-4" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} />
          <SelectField surface="dark" label="Status" value={status} onValueChange={setStatus} options={statusOptions} />
        </div>
      </div>

      {error ? <ErrorState title="Agents did not load" description={error} retry={{ onClick: refresh }} /> : null}
      {loading ? <LoadingState rows={5} label="Loading agents" /> : null}

      {!loading && data && data.departments.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4 text-center">
          <p className="text-sm font-medium text-[var(--foreground-80)]">Departments not set up yet</p>
          <p className="mt-1 text-xs text-[var(--foreground-50)]">Activate your company to create departments and agents.</p>
          <Button
            variant="app"
            size="sm"
            className="mt-3"
            disabled={activating}
            onClick={() => void activateDepartments()}
          >
            {activating ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {activating ? "Activating…" : "Activate company"}
          </Button>
        </div>
      ) : null}

      {!loading && data ? (
        compact ? (
          // Compact: list-or-detail navigation (one panel at a time)
          selectedAgentId ? (
            <div className="grid gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-fit text-[var(--foreground-70)] hover:bg-[var(--foreground-5)]"
                onClick={() => setSelectedAgentId(null)}
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                All agents
              </Button>
              {detailLoading ? (
                <LoadingState rows={5} label="Loading agent" />
              ) : (
                <AgentConfigPanel
                  orgId={orgId}
                  agent={selectedAgent}
                  catalog={data}
                  onAgentChange={(agent) => { setSelectedAgent(agent); refresh(); }}
                  onLaunchSession={onLaunchSession}
                />
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <AgentList agents={data.agents} selectedAgentId={selectedAgentId} onSelect={setSelectedAgentId} onLaunch={launchAgent} launchingId={launchingId} />
              <MarketplaceSkills skills={data.skills} selectedDepartmentSlug={null} />
            </div>
          )
        ) : (
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-4 content-start">
            <AgentList agents={data.agents} selectedAgentId={selectedAgentId} onSelect={setSelectedAgentId} onLaunch={launchAgent} launchingId={launchingId} />
            <MarketplaceSkills skills={selectedAgent?.recommendedSkills ?? data.skills} selectedDepartmentSlug={selectedAgent?.department.slug ?? null} />
          </div>
          {detailLoading ? (
            <LoadingState rows={5} label="Loading agent" />
          ) : (
            <AgentConfigPanel
              orgId={orgId}
              agent={selectedAgent}
              catalog={data}
              onAgentChange={(agent) => {
                setSelectedAgent(agent);
                refresh();
              }}
              onLaunchSession={onLaunchSession}
            />
          )}
        </div>
        )
      ) : null}

      <AgentCreateDialog
        orgId={orgId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        catalog={data}
        onCreated={(agent) => {
          setSelectedAgentId(agent.id);
          setSelectedAgent(agent);
          refresh();
        }}
      />
    </div>
  );
}

