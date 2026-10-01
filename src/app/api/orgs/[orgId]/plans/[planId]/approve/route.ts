import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { planActionResponse } from "@/lib/agents/plans/http";
import { approvePlan } from "@/lib/agents/plans/store";

type RouteContext = { params: Promise<{ orgId: string; planId: string }> };

/** Approve a proposed plan: its first steps start right away. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, planId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    return planActionResponse(orgId, planId, await approvePlan({ orgId, planId, userId: user.id }));
  } catch (error) {
    return routeError(error);
  }
}
