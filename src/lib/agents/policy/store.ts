import { prisma } from "@/lib/db/client";
import { ALWAYS_ASK_RISKS, TOOL_RISK } from "./risk";
import type { EffectivePolicy } from "./engine";
import { defaultLimits, type RunLimits } from "./limits";
import { audit } from "@/lib/security/audit";

export type PolicyRecord = {
  agentsPaused: boolean;
  perRunBudgetCents: number | null;
  dailyBudgetCents: number | null;
  autoApprove: string[];
  alwaysAsk: string[];
};

export type PolicyPatch = Partial<PolicyRecord>;

const EMPTY: PolicyRecord = {
  agentsPaused: false,
  perRunBudgetCents: null,
  dailyBudgetCents: null,
  autoApprove: [],
  alwaysAsk: []
};

function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

type Row = {
  agentsPaused: boolean;
  perRunBudgetCents: number | null;
  dailyBudgetCents: number | null;
  autoApproveJson: string;
  alwaysAskJson: string;
};

function toRecord(row: Row | null): PolicyRecord {
  if (!row) return { ...EMPTY };
  return {
    agentsPaused: row.agentsPaused,
    perRunBudgetCents: row.perRunBudgetCents,
    dailyBudgetCents: row.dailyBudgetCents,
    autoApprove: parseList(row.autoApproveJson),
    alwaysAsk: parseList(row.alwaysAskJson)
  };
}

export async function getOrgPolicy(orgId: string): Promise<PolicyRecord> {
  return toRecord(await prisma.policy.findFirst({ where: { organizationId: orgId, agentId: null } }));
}

export async function getAgentPolicy(orgId: string, agentId: string): Promise<PolicyRecord> {
  return toRecord(await prisma.policy.findFirst({ where: { organizationId: orgId, agentId } }));
}

/** Org rules and the agent's own rules merged: lists are unioned, an agent budget overrides the org's. */
export async function getEffectivePolicy(orgId: string, agentId: string) {
  const [org, agent] = await Promise.all([getOrgPolicy(orgId), getAgentPolicy(orgId, agentId)]);
  const policy: EffectivePolicy = {
    autoApprove: new Set([...org.autoApprove, ...agent.autoApprove]),
    alwaysAsk: new Set([...org.alwaysAsk, ...agent.alwaysAsk])
  };
  return {
    policy,
    agentsPaused: org.agentsPaused || agent.agentsPaused,
    perRunBudgetCents: agent.perRunBudgetCents ?? org.perRunBudgetCents,
    dailyBudgetCents: org.dailyBudgetCents,
    /** The agent's own daily cap (its own runs' spend), on top of the org's. */
    agentDailyBudgetCents: agent.dailyBudgetCents
  };
}

/** True when the org, or this agent, has been paused by an admin. */
export async function isOrgPaused(orgId: string, agentId: string): Promise<boolean> {
  const { agentsPaused } = await getEffectivePolicy(orgId, agentId);
  return agentsPaused;
}

/** Limits for a new run tree: environment defaults, with the org/agent per-run budget applied. */
export async function resolveRunLimits(orgId: string, agentId: string): Promise<RunLimits> {
  const limits = defaultLimits();
  const { perRunBudgetCents } = await getEffectivePolicy(orgId, agentId);
  return perRunBudgetCents != null ? { ...limits, budgetCents: perRunBudgetCents } : limits;
}

export class PolicyValidationError extends Error {}

/** Tools that may be pre-approved. Communication and spend tools never can, and unknown tools cannot be named. */
export function assertAutoApprovable(tools: string[]): void {
  for (const tool of tools) {
    const risk = TOOL_RISK[tool];
    if (!risk) throw new PolicyValidationError(`Unknown tool "${tool}".`);
    if (ALWAYS_ASK_RISKS.has(risk)) {
      throw new PolicyValidationError(`"${tool}" contacts people or spends money, so it always needs a fresh approval.`);
    }
    if (risk === "read" || risk === "write_internal" || risk === "delegate") {
      throw new PolicyValidationError(`"${tool}" is low risk and never asks, so it does not need to be pre-approved.`);
    }
  }
}

export function assertKnownTools(tools: string[]): void {
  for (const tool of tools) {
    if (!(tool in TOOL_RISK)) throw new PolicyValidationError(`Unknown tool "${tool}".`);
  }
}

/** Create or update the org policy (agentId undefined) or one agent's policy. */
export async function updatePolicy(orgId: string, patch: PolicyPatch, agentId?: string | null, actorUserId?: string | null) {
  const targetAgentId = agentId ?? null;
  if (patch.autoApprove) assertAutoApprovable(patch.autoApprove);
  if (patch.alwaysAsk) assertKnownTools(patch.alwaysAsk);

  const data = {
    ...(patch.agentsPaused !== undefined ? { agentsPaused: patch.agentsPaused } : {}),
    ...(patch.perRunBudgetCents !== undefined ? { perRunBudgetCents: patch.perRunBudgetCents } : {}),
    ...(patch.dailyBudgetCents !== undefined ? { dailyBudgetCents: patch.dailyBudgetCents } : {}),
    ...(patch.autoApprove ? { autoApproveJson: JSON.stringify([...new Set(patch.autoApprove)]) } : {}),
    ...(patch.alwaysAsk ? { alwaysAskJson: JSON.stringify([...new Set(patch.alwaysAsk)]) } : {})
  };

  const existing = await prisma.policy.findFirst({ where: { organizationId: orgId, agentId: targetAgentId } });
  const row = existing
    ? await prisma.policy.update({ where: { id: existing.id }, data })
    : await prisma.policy.create({ data: { organizationId: orgId, agentId: targetAgentId, ...data } });
  await audit({ orgId, actorUserId, action: "policy.updated", targetType: targetAgentId ? "agent" : "organization", targetId: targetAgentId ?? orgId, metadata: { change: patch } });
  return toRecord(row);
}

/** "Always approve this tool for this agent" from an approval card. */
export async function addAutoApprove(orgId: string, agentId: string, toolName: string): Promise<void> {
  const current = await getAgentPolicy(orgId, agentId);
  if (current.autoApprove.includes(toolName)) return;
  await updatePolicy(orgId, { autoApprove: [...current.autoApprove, toolName] }, agentId);
}
