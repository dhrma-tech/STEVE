import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { revokeApiKey } from "@/lib/automations/api-keys";
import { automationError } from "@/lib/automations/manage-http";

type RouteContext = { params: Promise<{ orgId: string; keyId: string }> };

/** Revoke a key. Requests with it fail from now on. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { orgId, keyId } = await context.params;
    await requireOrgAdmin(orgId);
    return (await revokeApiKey(orgId, keyId)) ? dataResponse({ revoked: true }) : errorResponse("NOT_FOUND", "API key not found", 404);
  } catch (error) {
    return automationError(error);
  }
}
