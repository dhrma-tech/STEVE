import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { sessionNotFoundResponse, updateSessionScratchpad } from "@/lib/agents/data";

const scratchpadSchema = z.object({
  scratchpad: z.string().max(12000)
});

type RouteContext = { params: Promise<{ orgId: string; sessionId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = scratchpadSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Scratchpad payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, sessionId } = await context.params;
    const session = await updateSessionScratchpad({ orgId, sessionId, scratchpad: parsed.data.scratchpad });
    return session ? dataResponse(session) : sessionNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

