import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createSubtask, taskNotFoundResponse } from "@/lib/tasks/data";

const subtaskSchema = z.object({
  title: z.string().trim().min(1).max(180)
});

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = subtaskSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Subtask payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, taskId } = await context.params;
    const task = await createSubtask({ orgId, taskId, title: parsed.data.title });
    return task ? dataResponse(task, { status: 201 }) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

