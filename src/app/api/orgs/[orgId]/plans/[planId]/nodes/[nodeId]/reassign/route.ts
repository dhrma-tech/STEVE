import { z } from "zod";
import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgWriter } from "@/lib/auth/session";
import { planActionResponse } from "@/lib/agents/plans/http";
import { reassignPlanStep } from "@/lib/agents/plans/store";

const schema = z.object({ agentId: z.string().min(1) });

type RouteContext = { params: Promise<{ orgId: string; planId: string; nodeId: string }> };

/** Give a step that has not started (or failed) to another agent. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId, planId, nodeId } = await context.params;
    await requireOrgWriter(orgId);
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "agentId is required", 422);
    return planActionResponse(orgId, planId, await reassignPlanStep({ orgId, planId, nodeId, agentId: parsed.data.agentId }));
  } catch (error) {
    return routeError(error);
  }
}
