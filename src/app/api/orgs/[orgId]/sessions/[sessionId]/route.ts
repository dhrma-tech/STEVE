import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getSessionDetail, sessionNotFoundResponse } from "@/lib/agents/data";

type RouteContext = { params: Promise<{ orgId: string; sessionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, sessionId } = await context.params;
    const session = await getSessionDetail(orgId, sessionId);
    return session ? dataResponse(session) : sessionNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

