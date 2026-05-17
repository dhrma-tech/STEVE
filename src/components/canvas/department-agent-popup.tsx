"use client";

import * as React from "react";
import { Cpu, Loader2, Play, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type AgentEntry = {
  id: string;
  name: string;
  status: string;
  model: string | null;
  counts: { sessions: number };
};

type ApiPayload<T> = { data?: T; error?: { message: string } };

export function DepartmentAgentPopup({
  orgId,
  departmentId,
  departmentName,
  departmentColor,
  screenX,
  screenY,
  onClose,
  onLaunch,
  onCreateAgent
}: {
  orgId: string;
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  screenX: number;
  screenY: number;
  onClose: () => void;
  onLaunch: (sessionId: string) => void;
  onCreateAgent: () => void;
}) {
  const [agents, setAgents] = React.useState<AgentEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [launchingId, setLaunchingId] = React.useState<string | null>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/orgs/${orgId}/agents?departmentId=${departmentId}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<ApiPayload<{ agents: AgentEntry[] }>>)
      .then((payload) => { if (payload.data) setAgents(payload.data.agents); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgId, departmentId]);

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function launchAgent(agentId: string) {
    setLaunchingId(agentId);
    try {
      const response = await fetch(`/api/orgs/${orgId}/agents/${agentId}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: null })
      });
      const payload = (await response.json()) as ApiPayload<{ session: { id: string } }>;
      if (payload.data?.session?.id) {
        onLaunch(payload.data.session.id);
        onClose();
      }
    } catch { /* ignore */ }
    finally { setLaunchingId(null); }
  }

  // Clamp position so popup stays on screen
  const left = Math.min(screenX + 12, window.innerWidth - 300);
  const top = Math.min(Math.max(screenY - 20, 72), window.innerHeight - 400);

  return (
    <div
      ref={popupRef}
      className="absolute z-50 w-[280px] overflow-hidden rounded-[14px] border border-[var(--border-10)] bg-[var(--background-l0-85)] shadow-[var(--tt-shadow-elevated-md)] backdrop-blur"
      style={{ left, top }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--border-10)]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-[6px] text-[10px] font-semibold"
            style={{ background: `${departmentColor}22`, color: departmentColor }}
          >
            {departmentName.slice(0, 1)}
          </span>
          <span className="truncate text-sm font-medium">{departmentName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--foreground-30)] hover:text-[var(--foreground-70)] transition-colors"
          aria-label="Close"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Agent list */}
      <div className="p-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-[var(--foreground-30)]" aria-hidden="true" />
          </div>
        ) : agents.length === 0 ? (
          <div className="py-3 text-center">
            <p className="text-xs text-[var(--foreground-40)]">No agents yet</p>
            <Button size="sm" variant="app" className="mt-2" onClick={() => { onCreateAgent(); onClose(); }}>
              Create agent
            </Button>
          </div>
        ) : (
          <div className="grid gap-1">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2",
                  agent.status === "running"
                    ? "bg-[var(--foreground-5)] animate-agent-pulse"
                    : "bg-[var(--foreground-3)] hover:bg-[var(--foreground-5)]"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="size-3.5 shrink-0 text-[var(--foreground-50)]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--foreground-80)]">{agent.name}</p>
                    <p className="text-[10px] text-[var(--foreground-40)]">{agent.counts.sessions} runs</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant={agent.status === "running" ? "running" : agent.status === "idle" ? "success" : "neutral"}>
                    {agent.status}
                  </Badge>
                  <button
                    type="button"
                    disabled={launchingId === agent.id || agent.status === "running"}
                    onClick={() => void launchAgent(agent.id)}
                    className="grid size-6 place-items-center rounded-[6px] bg-[var(--foreground-10)] text-[var(--foreground-60)] transition-all hover:bg-[var(--primary)] hover:text-white disabled:pointer-events-none disabled:opacity-40 active:scale-90"
                    aria-label={`Run ${agent.name}`}
                  >
                    {launchingId === agent.id
                      ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      : <Play className="size-3" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
