import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { deleteTrigger, serializeTrigger, updateTrigger } from "@/lib/automations/triggers";
import { automationError } from "@/lib/automations/manage-http";
import { triggerPatchSchema } from "@/lib/automations/schemas";

type RouteContext = { params: Promise<{ orgId: string; triggerId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId, triggerId } = await context.params;
    await requireOrgAdmin(orgId);
    const parsed = triggerPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Check the trigger fields.", 422, parsed.error.flatten());
    const trigger = await updateTrigger(orgId, triggerId, parsed.data);
    return trigger ? dataResponse({ trigger: serializeTrigger(trigger) }) : errorResponse("NOT_FOUND", "Trigger not found", 404);
  } catch (error) {
    return automationError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { orgId, triggerId } = await context.params;
    await requireOrgAdmin(orgId);
    return (await deleteTrigger(orgId, triggerId)) ? dataResponse({ deleted: true }) : errorResponse("NOT_FOUND", "Trigger not found", 404);
  } catch (error) {
    return automationError(error);
  }
}
