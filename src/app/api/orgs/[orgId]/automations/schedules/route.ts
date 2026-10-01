import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { createSchedule, serializeSchedule } from "@/lib/automations/schedules";
import { automationError } from "@/lib/automations/manage-http";
import { scheduleSchema } from "@/lib/automations/schemas";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = scheduleSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Check the schedule fields.", 422, parsed.error.flatten());
    return dataResponse({ schedule: serializeSchedule(await createSchedule(orgId, user.id, parsed.data)) }, { status: 201 });
  } catch (error) {
    return automationError(error);
  }
}
