import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { addTaskAttachments, taskNotFoundResponse } from "@/lib/tasks/data";

const attachmentSchema = z.object({
  fileIds: z.array(z.string().trim().min(1)).default([]),
  attachmentNames: z.array(z.string().trim().min(1).max(240)).default([])
});

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = attachmentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Attachment payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, taskId } = await context.params;
    const task = await addTaskAttachments({ orgId, taskId, ...parsed.data });
    return task ? dataResponse(task, { status: 201 }) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

