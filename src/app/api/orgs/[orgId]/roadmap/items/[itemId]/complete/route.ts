import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { completeRoadmapItem, roadmapNotFoundResponse } from "@/lib/roadmap/data";

type RouteContext = { params: Promise<{ orgId: string; itemId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, itemId } = await context.params;
    const result = await completeRoadmapItem({ orgId, itemId });

    if (result.kind === "not_found") {
      return roadmapNotFoundResponse();
    }

    if (result.kind === "blocked") {
      return errorResponse("CONFLICT", "This roadmap item needs earlier steps first.", 409, result);
    }

    return dataResponse(result);
  } catch (error) {
    return routeError(error);
  }
}
