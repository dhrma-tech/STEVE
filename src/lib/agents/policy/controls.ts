import { prisma } from "@/lib/db/client";
import { parsePermissionMode } from "../run-scope";
import { defaultDailyBudgetCents, defaultLimits } from "./limits";
import { spendToday } from "./spend";
import { getOrgPolicy } from "./store";

/** Everything the Agent controls screen shows: pause, budgets at every level, permission modes and today's spend. */
export async function getControlsData(orgId: string) {
  const [org, agents, departments, agentPolicies, today] = await Promise.all([
    getOrgPolicy(orgId),
    prisma.agent.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { id: true, name: true, slug: true, permissionsJson: true, departmentId: true, department: { select: { name: true, sortOrder: true } } },
      orderBy: [{ department: { sortOrder: "asc" } }, { name: "asc" }]
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, dailyBudgetCents: true },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.policy.findMany({ where: { organizationId: orgId, agentId: { not: null } } }),
    spendToday(orgId)
  ]);
  const policyByAgent = new Map(agentPolicies.map((policy) => [policy.agentId!, policy]));
  const limits = defaultLimits();

  return {
    org: {
      agentsPaused: org.agentsPaused,
      perRunBudgetCents: org.perRunBudgetCents,
      dailyBudgetCents: org.dailyBudgetCents,
      spentTodayCents: today.totalCents
    },
    defaults: { perRunBudgetCents: limits.budgetCents, dailyBudgetCents: defaultDailyBudgetCents() },
    departments: departments.map((department) => ({
      ...department,
      spentTodayCents: today.byDepartment.get(department.id) ?? 0
    })),
    agents: agents.map((agent) => {
      let mode = parsePermissionMode(undefined);
      try {
        mode = parsePermissionMode((JSON.parse(agent.permissionsJson ?? "{}") as { mode?: unknown }).mode);
      } catch {
        /* safe default */
      }
      const policy = policyByAgent.get(agent.id);
      return {
        id: agent.id,
        name: agent.name,
        slug: agent.slug,
        department: agent.department.name,
        mode,
        perRunBudgetCents: policy?.perRunBudgetCents ?? null,
        dailyBudgetCents: policy?.dailyBudgetCents ?? null,
        spentTodayCents: today.byAgent.get(agent.id) ?? 0
      };
    })
  };
}

export type ControlsData = Awaited<ReturnType<typeof getControlsData>>;
