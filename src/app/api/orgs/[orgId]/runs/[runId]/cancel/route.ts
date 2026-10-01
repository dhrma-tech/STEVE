import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { cancelRunTree } from "@/lib/mission/data";
import { runActionResponse } from "@/lib/mission/http";

type RouteContext = { params: Promise<{ orgId: string; runId: string }> };

/** Stop a run and everything it delegated. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, runId } = await context.params;
    await requireOrgWriter(orgId);
    return runActionResponse(await cancelRunTree({ orgId, runId }));
  } catch (error) {
    return routeError(error);
  }
}
