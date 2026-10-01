import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { createApiKey } from "@/lib/automations/api-keys";
import { automationError } from "@/lib/automations/manage-http";
import { apiKeySchema } from "@/lib/automations/schemas";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Create an API key. The key is returned once. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = apiKeySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Give the key a name.", 422, parsed.error.flatten());
    return dataResponse(await createApiKey(orgId, user.id, parsed.data.name, parsed.data.scopes), { status: 201 });
  } catch (error) {
    return automationError(error);
  }
}
