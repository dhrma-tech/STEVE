import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { getRunDetail } from "@/lib/mission/data";

type RouteContext = { params: Promise<{ orgId: string; runId: string }> };

/** One run with its full event log (timeline and replay), children and approvals. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, runId } = await context.params;
    await requireOrgMember(orgId);
    const detail = await getRunDetail(orgId, runId);
    if (!detail) return errorResponse("NOT_FOUND", "Run not found", 404);
    return dataResponse(detail);
  } catch (error) {
    return routeError(error);
  }
}
