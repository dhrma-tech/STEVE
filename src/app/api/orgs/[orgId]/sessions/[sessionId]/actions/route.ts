import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { advanceSessionActions, getSessionActions, sessionNotFoundResponse } from "@/lib/agents/data";

const actionSchema = z.object({
  finish: z.boolean().default(false)
});

type RouteContext = { params: Promise<{ orgId: string; sessionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, sessionId } = await context.params;
    const actions = await getSessionActions(orgId, sessionId);
    return actions ? dataResponse({ actions }) : sessionNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Session action payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, sessionId } = await context.params;
    const session = await advanceSessionActions(orgId, sessionId, parsed.data.finish);
    return session ? dataResponse(session) : sessionNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

