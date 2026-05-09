import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getPostizIntegration } from "@/lib/integrations/data";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const data = await getPostizIntegration(orgId);
    if (!data) return errorResponse("NOT_FOUND", "Postiz integration not found.", 404);
    return dataResponse(data);
  } catch (error) {
    return routeError(error);
  }
}
