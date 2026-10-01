import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { deleteSchedule, serializeSchedule, updateSchedule } from "@/lib/automations/schedules";
import { automationError } from "@/lib/automations/manage-http";
import { scheduleSchema } from "@/lib/automations/schemas";
import { audit } from "@/lib/security/audit";

type RouteContext = { params: Promise<{ orgId: string; scheduleId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId, scheduleId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = scheduleSchema.partial().safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Check the schedule fields.", 422, parsed.error.flatten());
    const schedule = await updateSchedule(orgId, scheduleId, parsed.data);
    if (schedule) await audit({ orgId, actorUserId: user.id, action: "schedule.updated", targetType: "schedule", targetId: schedule.id, metadata: { change: parsed.data } });
    return schedule ? dataResponse({ schedule: serializeSchedule(schedule) }) : errorResponse("NOT_FOUND", "Schedule not found", 404);
  } catch (error) {
    return automationError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { orgId, scheduleId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    if (!(await deleteSchedule(orgId, scheduleId))) return errorResponse("NOT_FOUND", "Schedule not found", 404);
    await audit({ orgId, actorUserId: user.id, action: "schedule.deleted", targetType: "schedule", targetId: scheduleId });
    return dataResponse({ deleted: true });
  } catch (error) {
    return automationError(error);
  }
}
