import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { revokeApiKey } from "@/lib/automations/api-keys";
import { automationError } from "@/lib/automations/manage-http";
import { audit } from "@/lib/security/audit";

type RouteContext = { params: Promise<{ orgId: string; keyId: string }> };

/** Revoke a key. Requests with it fail from now on. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { orgId, keyId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    if (!(await revokeApiKey(orgId, keyId))) return errorResponse("NOT_FOUND", "API key not found", 404);
    await audit({ orgId, actorUserId: user.id, action: "api_key.revoked", targetType: "api_key", targetId: keyId });
    return dataResponse({ revoked: true });
  } catch (error) {
    return automationError(error);
  }
}
