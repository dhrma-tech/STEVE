import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { taskNotFoundResponse, updateSubtask } from "@/lib/tasks/data";

const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(180).nullable().optional(),
  status: z.string().trim().min(1).max(80).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; taskId: string; subtaskId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = updateSubtaskSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Subtask update payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, taskId, subtaskId } = await context.params;
    const task = await updateSubtask({ orgId, taskId, subtaskId, ...parsed.data });
    return task ? dataResponse(task) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

