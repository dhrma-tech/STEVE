import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { appUrl } from "@/lib/agents/policy/one-tap";
import { listApiKeys } from "@/lib/automations/api-keys";
import { EVENT_LABELS, listChannels, ORG_EVENT_TYPES } from "@/lib/automations/channels";
import { listSchedules } from "@/lib/automations/schedules";
import { listTriggers } from "@/lib/automations/triggers";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Everything on the Automations tab: schedules, triggers and recent events, channels, API keys, agents to pick. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgAdmin(orgId);
    const [schedules, triggers, channels, apiKeys, agents] = await Promise.all([
      listSchedules(orgId),
      listTriggers(orgId),
      listChannels(orgId),
      listApiKeys(orgId),
      prisma.agent.findMany({
        where: { organizationId: orgId, status: { not: "archived" } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" }
      })
    ]);
    return dataResponse({
      schedules,
      ...triggers,
      channels,
      apiKeys,
      agents,
      eventTypes: ORG_EVENT_TYPES.map((type) => ({ type, label: EVENT_LABELS[type] })),
      hookBaseUrl: `${appUrl()}/api/hooks/`,
      apiBaseUrl: `${appUrl()}/api/v1`
    });
  } catch (error) {
    return routeError(error);
  }
}
