import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { addTaskComment, taskNotFoundResponse } from "@/lib/tasks/data";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  fileIds: z.array(z.string().trim().min(1)).default([])
});

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = commentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Comment payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, taskId } = await context.params;
    const task = await addTaskComment({ orgId, taskId, ...parsed.data });
    return task ? dataResponse(task, { status: 201 }) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

