import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getTaskDetail, taskNotFoundResponse, updateTask } from "@/lib/tasks/data";

const patchTaskSchema = z.object({
  title: z.string().trim().min(1).max(180).nullable().optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  status: z.enum(["queued", "running", "finished_turn", "ready_to_review", "completed", "blocked", "canceled"]).nullable().optional(),
  departmentId: z.string().trim().min(1).nullable().optional(),
  agentId: z.string().trim().min(1).nullable().optional(),
  assignedUserId: z.string().trim().min(1).nullable().optional(),
  priority: z.number().int().min(0).max(3).nullable().optional(),
  dueAt: z.string().trim().nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, taskId } = await context.params;
    const task = await getTaskDetail(orgId, taskId);
    return task ? dataResponse(task) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = patchTaskSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Task update payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, taskId } = await context.params;
    const task = await updateTask({ orgId, taskId, ...parsed.data });
    return task ? dataResponse(task) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

