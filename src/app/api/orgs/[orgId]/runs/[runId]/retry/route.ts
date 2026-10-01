import { z } from "zod";
import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { retryRun } from "@/lib/mission/data";
import { runActionResponse } from "@/lib/mission/http";

const retrySchema = z.object({ message: z.string().trim().max(4000).nullable().optional() });

type RouteContext = { params: Promise<{ orgId: string; runId: string }> };

/** Run a finished task again (optionally with a changed instruction). The old run stays in the history. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, runId } = await context.params;
    await requireOrgWriter(orgId);
    const parsed = retrySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "The retry request is invalid.", 422, parsed.error.flatten());
    return runActionResponse(await retryRun({ orgId, runId, message: parsed.data.message }));
  } catch (error) {
    return routeError(error);
  }
}
