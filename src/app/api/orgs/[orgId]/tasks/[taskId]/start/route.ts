import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { startTask, taskNotFoundResponse } from "@/lib/tasks/data";

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, taskId } = await context.params;
    const result = await startTask({ orgId, taskId });

    if (result.kind === "not_found") {
      return taskNotFoundResponse();
    }

    if (result.kind === "approval_required") {
      return errorResponse("CONFLICT", "This task is paused for human approval.", 409, result);
    }

    return dataResponse(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

