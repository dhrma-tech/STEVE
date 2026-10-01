import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { getMissionOverview } from "@/lib/mission/data";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Mission Control: run trees, plans in progress, what is waiting for the founder, and today's spend. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    return dataResponse(await getMissionOverview(orgId));
  } catch (error) {
    return routeError(error);
  }
}
