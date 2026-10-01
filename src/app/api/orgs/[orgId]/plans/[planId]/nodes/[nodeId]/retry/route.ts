import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { planActionResponse } from "@/lib/agents/plans/http";
import { retryPlanStep } from "@/lib/agents/plans/store";

type RouteContext = { params: Promise<{ orgId: string; planId: string; nodeId: string }> };

/** Retry a failed step; a stopped plan is reopened and carries on from it. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, planId, nodeId } = await context.params;
    await requireOrgWriter(orgId);
    return planActionResponse(orgId, planId, await retryPlanStep({ orgId, planId, nodeId }));
  } catch (error) {
    return routeError(error);
  }
}
