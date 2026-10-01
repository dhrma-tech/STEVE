import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { planActionResponse } from "@/lib/agents/plans/http";
import { cancelPlan } from "@/lib/agents/plans/store";

type RouteContext = { params: Promise<{ orgId: string; planId: string }> };

/** Stop a plan: running steps are cancelled and the rest are skipped. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, planId } = await context.params;
    await requireOrgWriter(orgId);
    return planActionResponse(orgId, planId, await cancelPlan({ orgId, planId }));
  } catch (error) {
    return routeError(error);
  }
}
