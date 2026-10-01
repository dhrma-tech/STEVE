import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { planActionResponse } from "@/lib/agents/plans/http";
import { editPlan, getPlan } from "@/lib/agents/plans/store";

const editSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(4000).optional(),
        agentId: z.string().min(1).optional(),
        acceptanceCriteria: z.array(z.string().trim().min(1).max(400)).max(10).optional(),
        dependsOn: z.array(z.string().trim().min(1)).max(20).optional(),
        review: z.boolean().optional(),
        remove: z.boolean().optional()
      })
    )
    .min(1)
    .max(40)
});

type RouteContext = { params: Promise<{ orgId: string; planId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, planId } = await context.params;
    await requireOrgMember(orgId);
    const plan = await getPlan(orgId, planId);
    if (!plan) return errorResponse("NOT_FOUND", "Plan not found", 404);
    return dataResponse({ plan });
  } catch (error) {
    return routeError(error);
  }
}

/** Change a proposed plan before approving it: retitle, rebrief, reassign, change criteria or dependencies, remove steps. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId, planId } = await context.params;
    await requireOrgMember(orgId);
    const parsed = editSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "The plan changes are invalid.", 422, parsed.error.flatten());
    return planActionResponse(orgId, planId, await editPlan({ orgId, planId, nodes: parsed.data.nodes }));
  } catch (error) {
    return routeError(error);
  }
}
