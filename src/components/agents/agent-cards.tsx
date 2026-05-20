"use client";

import { Cpu, Inbox, Loader2, Play, Plus, Settings2, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AgentPulseDot } from "@/components/motion/animated-list";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { agentModelOptions } from "@/data/agents";
import type { AgentSummary } from "@/components/agents/types";
import { cn } from "@/lib/utils/cn";

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function sessionStatusColor(status: string): string {
  if (status === "completed") return "text-green-400";
  if (status === "failed") return "text-red-400";
  if (status === "running") return "text-[var(--primary)]";
  return "text-[var(--foreground-40)]";
}

function statusStripColor(status: string): string {
  if (status === "running") return "var(--primary)";
  if (status === "error") return "var(--destructive)";
  if (status === "paused") return "#f59e0b";
  if (status === "archived") return "var(--foreground-30)";
  return "transparent";
}

function modelLabel(value: string | null | undefined) {
  if (!value) return "Default model";
  const match = agentModelOptions.find((option) => option.value === value);
  return match?.label ?? value;
}

export function AgentList({
  agents,
  selectedAgentId,
  onSelect,
  onLaunch,
  launchingId = null,
  onCreateAgent,
  emptyDepartmentName
}: {
  agents: AgentSummary[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  onLaunch: (agentId: string) => void;
  launchingId?: string | null;
  onCreateAgent?: () => void;
  emptyDepartmentName?: string;
}) {
  if (!agents.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-6 text-center">
        <Cpu aria-hidden="true" className="size-8 opacity-25" />
        <div>
          <p className="text-sm font-medium text-[var(--foreground-80)]">
            No {emptyDepartmentName ? `${emptyDepartmentName} ` : ""}agents yet
          </p>
          <p className="mt-1 text-xs text-[var(--foreground-50)]">
            Create your first agent to start working on tasks.
          </p>
        </div>
        {onCreateAgent ? (
          <Button size="sm" variant="app" onClick={onCreateAgent}>
            <Plus aria-hidden="true" className="size-3.5" />
            Create Agent
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Stagger className="grid gap-2">
      {agents.map((agent) => (
        <StaggerItem key={agent.id}>
          <article
            className={cn(
              "relative grid gap-3 overflow-hidden rounded-[12px] border p-3 transition-colors hover:bg-[var(--foreground-8)]",
              selectedAgentId === agent.id ? "border-[var(--primary)] bg-[var(--foreground-8)]" : "border-[var(--border-10)] bg-[var(--foreground-3)]",
              agent.status === "running" ? "animate-agent-pulse" : ""
            )}
          >
            {/* Status strip — colored left border */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: statusStripColor(agent.status) }}
            />
            <button
              type="button"
              className="flex items-start gap-3 rounded-[8px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
              onClick={() => onSelect(agent.id)}
              aria-pressed={selectedAgentId === agent.id}
            >
              <Avatar className="size-10">
                <AvatarFallback style={{ color: agent.department.color }}>
                  <Cpu aria-hidden="true" className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{agent.name}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--foreground-50)]">{agent.department.name} · {modelLabel(agent.model)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {agent.status === "running" && <AgentPulseDot color="#86efac" size={7} />}
                    <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                  </span>
                </div>
                {/* Fix 5 — last session summary */}
                {agent.recentSessions[0] ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--foreground-40)]">
                    <span>Last run {formatRelativeTime(agent.recentSessions[0].createdAt)}</span>
                    <span className="text-[var(--foreground-20)]" aria-hidden="true">·</span>
                    <span className="max-w-[90px] truncate">{agent.recentSessions[0].task?.title ?? "Untitled"}</span>
                    <span className="text-[var(--foreground-20)]" aria-hidden="true">·</span>
                    <span className={sessionStatusColor(agent.recentSessions[0].status)}>{agent.recentSessions[0].status}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--foreground-30)]">No sessions yet</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--foreground-50)]">
                  <span className="inline-flex items-center gap-1">
                    <Zap aria-hidden="true" className="size-3.5" />
                    {agent.skills.length || agent.recommendedSkills.length} skills
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Inbox aria-hidden="true" className="size-3.5" />
                    {agent.inboxAddress ?? "No email inbox"}
                  </span>
                  <span>{agent.counts.sessions} runs</span>
                </div>
              </div>
            </button>

            {/* Config first (secondary), Run last (primary) */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                title="Edit configuration · E"
                className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]"
                onClick={() => onSelect(agent.id)}
              >
                <Settings2 aria-hidden="true" className="size-4" />
                Configure
              </Button>
              <Button
                size="sm"
                variant="app"
                title="Run agent · R"
                disabled={launchingId === agent.id}
                onClick={() => onLaunch(agent.id)}
              >
                {launchingId === agent.id
                  ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  : <Play aria-hidden="true" className="size-4" />}
                {launchingId === agent.id ? "Starting…" : "Run"}
              </Button>
            </div>
          </article>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function MarketplaceSkills({ skills, selectedDepartmentSlug }: { skills: ReadonlyArray<AgentSummary["recommendedSkills"][number]>; selectedDepartmentSlug?: string | null }) {
  const visible = selectedDepartmentSlug
    ? skills.filter((skill) => skill.departmentSlug === selectedDepartmentSlug || skill.category === "Integration")
    : skills;

  if (!visible.length) return null;

  return (
    <section className="grid gap-3 rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-3">
      <div className="flex items-center gap-2">
        <Zap aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
        <h3 className="text-sm font-medium">Available skills</h3>
      </div>
      <Stagger className="grid gap-2" staggerChildren={0.05}>
        {visible.slice(0, 6).map((skill) => (
          <StaggerItem key={skill.key} y={8}>
            <div className="rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-inverse-10)] p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-medium">{skill.name}</h4>
                <Badge variant="neutral">{skill.category}</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--foreground-50)]">{skill.description}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function statusVariant(status: string): BadgeVariant {
  if (status === "idle") return "success";
  if (status === "running") return "running";
  if (status === "error") return "danger";
  if (status === "archived") return "neutral";
  return "warning";
}
