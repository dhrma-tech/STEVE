import { z } from "zod";
import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { addRunComment } from "@/lib/mission/data";
import { runActionResponse } from "@/lib/mission/http";

const commentSchema = z.object({ body: z.string().trim().min(1).max(4000) });

type RouteContext = { params: Promise<{ orgId: string; runId: string }> };

/** Comment on a run. The comment lands in the task's chat, where the team and later runs see it. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, runId } = await context.params;
    const { user } = await requireOrgWriter(orgId);
    const parsed = commentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "A comment is required.", 422, parsed.error.flatten());
    return runActionResponse(await addRunComment({ orgId, runId, userId: user.id, body: parsed.data.body }));
  } catch (error) {
    return routeError(error);
  }
}
