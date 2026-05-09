import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { createTaskApproval, taskNotFoundResponse } from "@/lib/tasks/data";

const approvalSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).nullable().optional(),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium")
});

type RouteContext = { params: Promise<{ orgId: string; taskId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = approvalSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Approval payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, taskId } = await context.params;
    const task = await createTaskApproval({ orgId, taskId, ...parsed.data });
    return task ? dataResponse(task, { status: 201 }) : taskNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

