import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { appUrl } from "@/lib/agents/policy/one-tap";
import { createTrigger, serializeTrigger } from "@/lib/automations/triggers";
import { automationError } from "@/lib/automations/manage-http";
import { triggerSchema } from "@/lib/automations/schemas";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Create a trigger. The response carries the endpoint URL once; store it in the sending service. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = triggerSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Check the trigger fields.", 422, parsed.error.flatten());
    const { trigger, token } = await createTrigger(orgId, user.id, parsed.data);
    return dataResponse({ trigger: serializeTrigger(trigger), endpointUrl: `${appUrl()}/api/hooks/${token}` }, { status: 201 });
  } catch (error) {
    return automationError(error);
  }
}
