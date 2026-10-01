import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember, requireOrgWriter } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { createGoalPlan, getPlan, listPlans } from "@/lib/agents/plans/store";

const createSchema = z.object({
  goal: z.string().trim().min(3).max(1000),
  context: z.string().trim().max(4000).nullable().optional(),
  roadmapItemId: z.string().trim().min(1).nullable().optional(),
  /** Start without review when the plan fits the daily budget. Honoured for owners and admins only. */
  autoApprove: z.boolean().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

/** Recent plans for the org, newest first. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    return dataResponse({ plans: await listPlans(orgId) });
  } catch (error) {
    return routeError(error);
  }
}

/** Give the Chief of Staff a goal. Returns the drafting plan and the planning session to watch. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user, membership } = await requireOrgWriter(orgId);
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "A goal of at least 3 characters is required.", 422, parsed.error.flatten());

    if (parsed.data.roadmapItemId) {
      const item = await prisma.roadmapItem.findFirst({ where: { id: parsed.data.roadmapItemId, organizationId: orgId }, select: { id: true } });
      if (!item) return errorResponse("NOT_FOUND", "Roadmap item not found", 404);
    }

    const isManager = ["owner", "admin"].includes(membership.role);
    const { plan, sessionId } = await createGoalPlan({
      orgId,
      userId: user.id,
      goal: parsed.data.goal,
      context: parsed.data.context ?? null,
      roadmapItemId: parsed.data.roadmapItemId ?? null,
      autoApprove: isManager && !!parsed.data.autoApprove
    });
    return dataResponse({ plan: await getPlan(orgId, plan.id), sessionId }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
