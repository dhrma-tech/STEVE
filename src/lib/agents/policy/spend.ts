import { prisma } from "@/lib/db/client";

/**
 * What agents spent today. A run's `costCents` includes everything it delegated, so a run's *own* spend is its cost
 * minus its direct children's. Summing own spend attributes delegated work to the agent (and department) that did it.
 */

export function startOfToday(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

export type SpendToday = {
  totalCents: number;
  byAgent: Map<string, number>;
  byDepartment: Map<string, number>;
};

export async function spendToday(orgId: string, now = new Date()): Promise<SpendToday> {
  const runs = await prisma.run.findMany({
    where: { organizationId: orgId, createdAt: { gte: startOfToday(now) } },
    select: { id: true, parentRunId: true, agentId: true, costCents: true }
  });
  const childCost = new Map<string, number>();
  for (const run of runs) {
    if (run.parentRunId) childCost.set(run.parentRunId, (childCost.get(run.parentRunId) ?? 0) + run.costCents);
  }
  const agents = await prisma.agent.findMany({
    where: { id: { in: [...new Set(runs.map((run) => run.agentId))] } },
    select: { id: true, departmentId: true }
  });
  const departmentOf = new Map(agents.map((agent) => [agent.id, agent.departmentId]));

  const byAgent = new Map<string, number>();
  const byDepartment = new Map<string, number>();
  let totalCents = 0;
  for (const run of runs) {
    const own = Math.max(0, run.costCents - (childCost.get(run.id) ?? 0));
    if (own === 0) continue;
    totalCents += own;
    byAgent.set(run.agentId, (byAgent.get(run.agentId) ?? 0) + own);
    const department = departmentOf.get(run.agentId);
    if (department) byDepartment.set(department, (byDepartment.get(department) ?? 0) + own);
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    totalCents: round(totalCents),
    byAgent: new Map([...byAgent].map(([id, cents]) => [id, round(cents)])),
    byDepartment: new Map([...byDepartment].map(([id, cents]) => [id, round(cents)]))
  };
}
