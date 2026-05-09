import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getRoadmapData } from "@/lib/roadmap/data";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    return dataResponse(await getRoadmapData(orgId));
  } catch (error) {
    return routeError(error);
  }
}
