import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgAdmin, requireOrgMember } from "@/lib/auth/session";
import { defaultDailyBudgetCents, defaultLimits } from "@/lib/agents/policy/limits";
import { TOOL_RISK } from "@/lib/agents/policy/risk";
import { getAgentPolicy, getOrgPolicy, PolicyValidationError, updatePolicy } from "@/lib/agents/policy/store";
import { prisma } from "@/lib/db/client";

const policySchema = z.object({
  /** Omit to change the org-wide policy; pass an agent id to change that agent's rules only. */
  agentId: z.string().trim().min(1).nullable().optional(),
  agentsPaused: z.boolean().optional(),
  perRunBudgetCents: z.number().int().min(1).max(100_000).nullable().optional(),
  dailyBudgetCents: z.number().int().min(1).max(1_000_000).nullable().optional(),
  autoApprove: z.array(z.string().trim().min(1)).max(50).optional(),
  alwaysAsk: z.array(z.string().trim().min(1)).max(50).optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    const agentId = new URL(request.url).searchParams.get("agentId");

    return dataResponse({
      org: await getOrgPolicy(orgId),
      agent: agentId ? await getAgentPolicy(orgId, agentId) : null,
      defaults: { ...defaultLimits(), dailyBudgetCents: defaultDailyBudgetCents() },
      toolRisks: TOOL_RISK
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgAdmin(orgId);

    const parsed = policySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Agent policy payload is invalid.", 422, parsed.error.flatten());
    }

    const { agentId, ...patch } = parsed.data;
    if (agentId) {
      const agent = await prisma.agent.findFirst({ where: { id: agentId, organizationId: orgId, archivedAt: null } });
      if (!agent) return errorResponse("NOT_FOUND", "Agent not found", 404);
    }
    if (agentId && (patch.agentsPaused !== undefined || patch.dailyBudgetCents !== undefined)) {
      return errorResponse("VALIDATION_ERROR", "Pause and daily budget are organization-wide settings.", 422);
    }

    try {
      return dataResponse(await updatePolicy(orgId, patch, agentId ?? null));
    } catch (error) {
      if (error instanceof PolicyValidationError) return errorResponse("VALIDATION_ERROR", error.message, 422);
      throw error;
    }
  } catch (error) {
    return routeError(error);
  }
}
