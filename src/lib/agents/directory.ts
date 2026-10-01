import { prisma } from "@/lib/db/client";
import { ACTIVE_STATUSES } from "./engine/types";
import { buildToolset } from "./tools/registry";
import { SYSTEM_AGENT_SLUGS } from "./plans/system-agents";

/**
 * The agent directory: who is on the team, what each agent is for and what it can do. Injected into every agent's
 * system prompt so delegation is deliberate (the right teammate, by slug) instead of guessed.
 */
export type DirectoryEntry = {
  id: string;
  name: string;
  slug: string;
  department: string;
  departmentSlug: string;
  role: string;
  capabilities: string[];
  /** Integration tools beyond the ones every agent has. */
  tools: string[];
  /** Runs of this agent in progress right now. */
  activeRuns: number;
};

const MAX_ENTRIES = 30;
const BASE_TOOLS = new Set(buildToolset([]).map((tool) => tool.definition.name));

function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
  } catch {
    return [];
  }
}

function skillKeysOf(toolsJson: string | null): string[] {
  try {
    const config = JSON.parse(toolsJson ?? "{}") as { skillKeys?: unknown };
    return Array.isArray(config.skillKeys) ? config.skillKeys.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}

export async function loadDirectory(orgId: string): Promise<DirectoryEntry[]> {
  const [agents, load] = await Promise.all([
    prisma.agent.findMany({
      // The Chief of Staff and the Reviewer coordinate the team; nobody delegates to them.
      where: { organizationId: orgId, archivedAt: null, slug: { notIn: [...SYSTEM_AGENT_SLUGS] } },
      include: { department: { select: { name: true, slug: true, description: true, sortOrder: true } } },
      orderBy: [{ department: { sortOrder: "asc" } }, { name: "asc" }],
      take: MAX_ENTRIES
    }),
    prisma.run.groupBy({
      by: ["agentId"],
      where: { organizationId: orgId, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true }
    })
  ]);
  const activeByAgent = new Map(load.map((row) => [row.agentId, row._count._all]));

  return agents.map((agent) => {
    const skillKeys = skillKeysOf(agent.toolsJson);
    const capabilities = parseStringArray(agent.capabilitiesJson);
    return {
      id: agent.id,
      name: agent.name,
      slug: agent.slug,
      department: agent.department.name,
      departmentSlug: agent.department.slug,
      role: (agent.role ?? agent.description ?? agent.department.description ?? "").trim(),
      capabilities: capabilities.length > 0 ? capabilities : skillKeys,
      tools: buildToolset(skillKeys)
        .map((tool) => tool.definition.name)
        .filter((name) => !BASE_TOOLS.has(name)),
      activeRuns: activeByAgent.get(agent.id) ?? 0
    };
  });
}

/** Markdown for the system prompt. The agent reading it is marked so it does not try to delegate to itself. */
export function renderDirectory(entries: DirectoryEntry[], selfAgentId: string): string {
  if (entries.length === 0) return "";
  const lines = entries.map((entry) => {
    const self = entry.id === selfAgentId ? " (you)" : "";
    const parts = [
      `- **${entry.name}**${self}, slug \`${entry.slug}\`, ${entry.department}`,
      entry.role ? `: ${entry.role}` : "",
      entry.capabilities.length ? ` Capabilities: ${entry.capabilities.slice(0, 8).join(", ")}.` : "",
      entry.tools.length ? ` Tools: ${entry.tools.join(", ")}.` : "",
      entry.activeRuns > 0 ? ` Busy: ${entry.activeRuns} run${entry.activeRuns === 1 ? "" : "s"} in progress.` : ""
    ];
    return parts.join("");
  });
  return ["## Your team", "Every agent also has web search, files, memory and tasks.", ...lines].join("\n");
}

/** How to work with the team, for agents that may delegate. */
export function collaborationGuide(options: { mustHandOff: boolean }): string {
  return [
    "## Working with your team",
    "- Do the work yourself when it is in your area. Delegate only what another teammate is better placed to do.",
    "- Delegate with `delegate_agent` (one teammate) or `delegate_many` (several at once, in parallel). Give a clear objective, the context they need, constraints and acceptance criteria.",
    "- Each teammate hands back a structured result (status, summary, artifacts, findings, next steps). Check it against your acceptance criteria before relying on it.",
    "- Use `ask_agent` for a quick question to a teammate, and `ask_user` when only the founder can answer. Do not guess about things only the founder knows.",
    options.mustHandOff
      ? "- You were given this work by another agent. When you are done, or cannot go further, call `finish_run` with an honest handoff. Do not end with plain text."
      : "- When the work is done you may call `finish_run` to hand back a structured result, or simply answer."
  ].join("\n");
}
