"use client";

import * as React from "react";
import { Bot, Filter, Plus, RefreshCw, Search } from "lucide-react";
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
  compact = false,
  onLaunchSession
}: {
  orgId: string;
  initialAgentId?: string | null;
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

  async function launchAgent(agentId: string) {
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${agentId}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Start a sandbox agent run." })
      });
      const payload = (await response.json()) as ApiPayload<{ kind: "launched"; session: { id: string } }>;
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Agent could not launch.");
      onLaunchSession(payload.data.session.id);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent could not launch.");
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
          <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.06)] text-[var(--app-primary-light)]">
            <Bot aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">Agents</p>
            <h2 className="text-lg font-medium tracking-[0px]">Company team</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={refresh}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <Button variant="app" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            New Agent
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
        <div className="flex items-center gap-2">
          <Filter aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
          <h3 className="text-sm font-medium">Filters</h3>
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--app-text-50)]" />
          <Input surface="dark" label="Search agents" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField surface="dark" label="Department" value={departmentId} onValueChange={setDepartmentId} options={departmentOptions} />
          <SelectField surface="dark" label="Status" value={status} onValueChange={setStatus} options={statusOptions} />
        </div>
      </div>

      {error ? <ErrorState title="Agents did not load" description={error} retry={{ onClick: refresh }} /> : null}
      {loading ? <LoadingState rows={5} label="Loading agents" /> : null}

      {!loading && data ? (
        <div className={`grid gap-4 ${compact ? "" : "2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"}`}>
          <div className="grid gap-4 content-start">
            <AgentList agents={data.agents} selectedAgentId={selectedAgentId} onSelect={setSelectedAgentId} onLaunch={launchAgent} />
            <MarketplaceSkills skills={selectedAgent?.recommendedSkills ?? data.skills} selectedDepartmentSlug={selectedAgent?.department.slug ?? null} />
          </div>
          {detailLoading ? (
            <LoadingState rows={5} label="Loading agent detail" />
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

