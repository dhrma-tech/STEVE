import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { createApiKey } from "@/lib/automations/api-keys";
import { automationError } from "@/lib/automations/manage-http";
import { apiKeySchema } from "@/lib/automations/schemas";
import { audit } from "@/lib/security/audit";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Create an API key. The key is returned once. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = apiKeySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Give the key a name.", 422, parsed.error.flatten());
    const created = await createApiKey(orgId, user.id, parsed.data.name, parsed.data.scopes);
    await audit({ orgId, actorUserId: user.id, action: "api_key.created", targetType: "api_key", targetId: created.apiKey.id, metadata: { name: created.apiKey.name, prefix: created.apiKey.prefix, scopes: created.apiKey.scopes } });
    return dataResponse(created, { status: 201 });
  } catch (error) {
    return automationError(error);
  }
}
