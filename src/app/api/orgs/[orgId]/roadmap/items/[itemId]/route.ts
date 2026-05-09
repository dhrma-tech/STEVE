import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getRoadmapItemDetail, roadmapNotFoundResponse } from "@/lib/roadmap/data";

type RouteContext = { params: Promise<{ orgId: string; itemId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, itemId } = await context.params;
    const item = await getRoadmapItemDetail(orgId, itemId);
    return item ? dataResponse(item) : roadmapNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}
