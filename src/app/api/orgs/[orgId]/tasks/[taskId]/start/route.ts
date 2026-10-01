import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { startTask, taskNotFoundResponse } from "@/lib/tasks/data";
import { enforceRateLimit } from "@/lib/security/rate-limit";

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, taskId } = await context.params;
    await enforceRateLimit("run_start", `org:${orgId}`);
    const result = await startTask({ orgId, taskId });

    if (result.kind === "not_found") {
      return taskNotFoundResponse();
    }

    if (result.kind === "approval_required") {
      return errorResponse("CONFLICT", "This task is paused for human approval.", 409, result);
    }

    if (result.kind === "no_agent") {
      return errorResponse(
        "CONFLICT",
        "No agent is assigned to this task and its department has no agent to run it. Assign an agent first.",
        409
      );
    }

    return dataResponse(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

