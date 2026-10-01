import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { fireSchedule, serializeSchedule } from "@/lib/automations/schedules";
import { automationError } from "@/lib/automations/manage-http";

type RouteContext = { params: Promise<{ orgId: string; scheduleId: string }> };

/** Run a schedule now, outside its timetable. Its next scheduled time is unchanged. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, scheduleId } = await context.params;
    await requireOrgAdmin(orgId);
    const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, organizationId: orgId } });
    if (!schedule) return errorResponse("NOT_FOUND", "Schedule not found", 404);
    const result = await fireSchedule(schedule);
    const fresh = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    return dataResponse({ result, schedule: serializeSchedule(fresh) }, { status: result.ok ? 201 : 409 });
  } catch (error) {
    return automationError(error);
  }
}
