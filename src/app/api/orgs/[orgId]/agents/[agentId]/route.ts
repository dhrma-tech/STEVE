import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { agentNotFoundResponse, getAgentDetail, updateAgent } from "@/lib/agents/data";
import { audit } from "@/lib/security/audit";
import { requireOrgAdmin } from "@/lib/auth/session";

const patchAgentSchema = z.object({
  name: z.string().trim().min(1).max(120).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  departmentId: z.string().trim().min(1).nullable().optional(),
  status: z.string().trim().min(1).max(80).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  prompt: z.string().trim().max(4000).nullable().optional(),
  skillKeys: z.array(z.string().trim().min(1)).optional(),
  permissionMode: z.enum(["review_required", "sandbox_only", "trusted"]).nullable().optional(),
  inboxAddress: z.string().trim().max(180).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; agentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, agentId } = await context.params;
    const agent = await getAgentDetail(orgId, agentId);
    return agent ? dataResponse(agent) : agentNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = patchAgentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Agent update payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, agentId } = await context.params;
    const agent = await updateAgent({ orgId, agentId, ...parsed.data });
    if (agent) {
      const { user } = await requireOrgAdmin(orgId);
      await audit({ orgId, actorUserId: user.id, action: "agent.updated", targetType: "agent", targetId: agentId, metadata: { change: parsed.data } });
    }
    return agent ? dataResponse(agent) : agentNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

