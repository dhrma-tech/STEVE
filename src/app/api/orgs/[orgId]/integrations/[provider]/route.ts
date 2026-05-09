import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getIntegrationDetail } from "@/lib/integrations/data";

type RouteContext = { params: Promise<{ orgId: string; provider: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, provider } = await context.params;
    const data = await getIntegrationDetail(orgId, provider);
    if (!data) return errorResponse("NOT_FOUND", "Integration not found.", 404);
    return dataResponse(data);
  } catch (error) {
    return routeError(error);
  }
}
