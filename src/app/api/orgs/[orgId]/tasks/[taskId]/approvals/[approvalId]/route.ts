import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { reviewTaskApproval, taskNotFoundResponse } from "@/lib/tasks/data";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"])
});

type RouteContext = { params: Promise<{ orgId: string; taskId: string; approvalId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = reviewSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Approval review payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, taskId, approvalId } = await context.params;
    const task = await reviewTaskApproval({ orgId, taskId, approvalId, status: parsed.data.status });
    return task ? dataResponse(task) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

