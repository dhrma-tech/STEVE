import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { deleteTrigger, serializeTrigger, updateTrigger } from "@/lib/automations/triggers";
import { automationError } from "@/lib/automations/manage-http";
import { triggerPatchSchema } from "@/lib/automations/schemas";
import { audit } from "@/lib/security/audit";

type RouteContext = { params: Promise<{ orgId: string; triggerId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId, triggerId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = triggerPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Check the trigger fields.", 422, parsed.error.flatten());
    const trigger = await updateTrigger(orgId, triggerId, parsed.data);
    if (trigger) await audit({ orgId, actorUserId: user.id, action: "trigger.updated", targetType: "trigger", targetId: trigger.id, metadata: { change: { ...parsed.data, signingSecret: parsed.data.signingSecret === undefined ? undefined : "(changed)" } } });
    return trigger ? dataResponse({ trigger: serializeTrigger(trigger) }) : errorResponse("NOT_FOUND", "Trigger not found", 404);
  } catch (error) {
    return automationError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { orgId, triggerId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    if (!(await deleteTrigger(orgId, triggerId))) return errorResponse("NOT_FOUND", "Trigger not found", 404);
    await audit({ orgId, actorUserId: user.id, action: "trigger.deleted", targetType: "trigger", targetId: triggerId });
    return dataResponse({ deleted: true });
  } catch (error) {
    return automationError(error);
  }
}
