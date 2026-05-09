"use client";

import { Bot, Inbox, Play, Settings2, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AgentPulseDot } from "@/components/motion/animated-list";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { AgentSummary } from "@/components/agents/types";
import { cn } from "@/lib/utils/cn";

export function AgentList({
  agents,
  selectedAgentId,
  onSelect,
  onLaunch
}: {
  agents: AgentSummary[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  onLaunch: (agentId: string) => void;
}) {
  if (!agents.length) {
    return <EmptyState surface="dark" title="No agents" description="Create an agent or activate departments to populate the company team." />;
  }

  return (
    <Stagger className="grid gap-2">
      {agents.map((agent) => (
        <StaggerItem key={agent.id}>
          <article
            className={cn(
              "grid gap-3 rounded-[12px] border p-3 transition-colors hover:bg-[rgba(255,255,255,0.07)]",
              selectedAgentId === agent.id ? "border-[var(--app-primary-light)] bg-[rgba(255,255,255,0.08)]" : "border-[var(--app-border)] bg-[rgba(255,255,255,0.04)]"
            )}
          >
            <button
              type="button"
              className="flex items-start gap-3 rounded-[8px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]"
              onClick={() => onSelect(agent.id)}
              aria-pressed={selectedAgentId === agent.id}
            >
              <Avatar className="size-10">
                <AvatarFallback style={{ color: agent.department.color }}>
                  <Bot aria-hidden="true" className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{agent.name}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--app-text-50)]">{agent.department.name} / {agent.model ?? "sandbox model"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {agent.status === "running" && (
                      <AgentPulseDot color="#86efac" size={7} />
                    )}
                    <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-50)]">
                  <span className="inline-flex items-center gap-1">
                    <Zap aria-hidden="true" className="size-3.5" />
                    {agent.skills.length || agent.recommendedSkills.length} skills
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Inbox aria-hidden="true" className="size-3.5" />
                    {agent.inboxAddress ?? "No inbox"}
                  </span>
                  <span>{agent.counts.sessions} sessions</span>
                </div>
              </div>
            </button>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="app" onClick={() => onLaunch(agent.id)}>
                <Play aria-hidden="true" className="size-4" />
                Launch
              </Button>
              <Button size="sm" variant="ghost" className="text-[var(--app-text)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => onSelect(agent.id)}>
                <Settings2 aria-hidden="true" className="size-4" />
                Config
              </Button>
            </div>
          </article>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function MarketplaceSkills({ skills, selectedDepartmentSlug }: { skills: ReadonlyArray<AgentSummary["recommendedSkills"][number]>; selectedDepartmentSlug?: string | null }) {
  const visible = selectedDepartmentSlug ? skills.filter((skill) => skill.departmentSlug === selectedDepartmentSlug || skill.category === "Integration") : skills;

  return (
    <section className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
      <div className="flex items-center gap-2">
        <Zap aria-hidden="true" className="size-4 text-[var(--app-primary-light)]" />
        <h3 className="text-sm font-medium">Marketplace skills</h3>
      </div>
      <Stagger className="grid gap-2" staggerChildren={0.05}>
        {visible.slice(0, 8).map((skill) => (
          <StaggerItem key={skill.key} y={8}>
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(0,0,0,0.12)] p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-medium">{skill.name}</h4>
                <Badge variant="neutral">{skill.category}</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--app-text-50)]">{skill.description}</p>
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
