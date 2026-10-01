import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember, requireOrgWriter } from "@/lib/auth/session";
import { createBriefing, listBriefings } from "@/lib/briefings/briefings";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    return dataResponse({ briefings: await listBriefings(orgId) });
  } catch (error) {
    return routeError(error);
  }
}

/** A briefing now, covering the last 24 hours. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgWriter(orgId);
    const briefing = await createBriefing(orgId, "manual");
    return dataResponse({ briefingId: briefing.id, status: briefing.status }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
