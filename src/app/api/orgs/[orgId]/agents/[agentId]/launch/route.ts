import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { launchAgentSession } from "@/lib/agents/data";

const launchSchema = z.object({
  taskId: z.string().trim().min(1).nullable().optional(),
  message: z.string().trim().max(4000).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; agentId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = launchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Agent launch payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, agentId } = await context.params;
    const result = await launchAgentSession({ orgId, agentId, ...parsed.data });
    if (result.kind === "not_found") return errorResponse("NOT_FOUND", "Agent or task not found", 404);
    if (result.kind === "approval_required") return errorResponse("CONFLICT", "This task needs approval before launch.", 409, result);

    return dataResponse(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

