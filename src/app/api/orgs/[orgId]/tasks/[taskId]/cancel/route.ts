import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { cancelTask, taskNotFoundResponse } from "@/lib/tasks/data";

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, taskId } = await context.params;
    const task = await cancelTask({ orgId, taskId });
    return task ? dataResponse(task) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

