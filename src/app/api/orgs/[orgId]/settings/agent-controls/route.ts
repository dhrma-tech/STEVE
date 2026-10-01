import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { isManagerRole } from "@/lib/auth/roles";
import { getControlsData } from "@/lib/agents/policy/controls";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Pause, budgets at every level, permission modes and today's spend. Changes go through agent-policy and agents. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { membership } = await requireOrgMember(orgId);
    return dataResponse({ ...(await getControlsData(orgId)), canEdit: isManagerRole(membership.role) });
  } catch (error) {
    return routeError(error);
  }
}
