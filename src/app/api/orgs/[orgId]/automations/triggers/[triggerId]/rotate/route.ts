import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { appUrl } from "@/lib/agents/policy/one-tap";
import { rotateTriggerToken } from "@/lib/automations/triggers";
import { automationError } from "@/lib/automations/manage-http";
import { audit } from "@/lib/security/audit";

type RouteContext = { params: Promise<{ orgId: string; triggerId: string }> };

/** Issue a new endpoint URL; the old one stops working at once. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, triggerId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const token = await rotateTriggerToken(orgId, triggerId);
    if (token) await audit({ orgId, actorUserId: user.id, action: "trigger.url_rotated", targetType: "trigger", targetId: triggerId });
    return token ? dataResponse({ endpointUrl: `${appUrl()}/api/hooks/${token}` }) : errorResponse("NOT_FOUND", "Trigger not found", 404);
  } catch (error) {
    return automationError(error);
  }
}
