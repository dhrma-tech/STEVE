"use client";

import { Cpu, Inbox, Loader2, Play, Settings2, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AgentPulseDot } from "@/components/motion/animated-list";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { agentModelOptions } from "@/data/agents";
import type { AgentSummary } from "@/components/agents/types";
import { cn } from "@/lib/utils/cn";

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
  launchingId = null
}: {
  agents: AgentSummary[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  onLaunch: (agentId: string) => void;
  launchingId?: string | null;
}) {
  if (!agents.length) {
    return <EmptyState surface="dark" title="No agents yet" description="Create your first agent using the button above." />;
  }

  return (
    <Stagger className="grid gap-2">
      {agents.map((agent) => (
        <StaggerItem key={agent.id}>
          <article
            className={cn(
              "grid gap-3 rounded-[12px] border p-3 transition-colors hover:bg-[var(--foreground-8)]",
              selectedAgentId === agent.id ? "border-[var(--primary)] bg-[var(--foreground-8)]" : "border-[var(--border-10)] bg-[var(--foreground-3)]",
              agent.status === "running" ? "animate-agent-pulse" : ""
            )}
          >
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
              <Button size="sm" variant="ghost" className="text-[var(--foreground-80)] hover:bg-[var(--foreground-5)]" onClick={() => onSelect(agent.id)}>
                <Settings2 aria-hidden="true" className="size-4" />
                Configure
              </Button>
              <Button size="sm" variant="app" disabled={launchingId === agent.id} onClick={() => onLaunch(agent.id)}>
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
