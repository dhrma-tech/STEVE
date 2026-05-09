import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { disconnectIntegration } from "@/lib/integrations/data";

type RouteContext = { params: Promise<{ orgId: string; provider: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, provider } = await context.params;
    return dataResponse(await disconnectIntegration({ orgId, provider }));
  } catch (error) {
    return routeError(error);
  }
}
