import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/settings/data";

const notificationsSchema = z.object({
  desktopAlerts: z.boolean().nullable().optional(),
  emailTaskUpdates: z.boolean().nullable().optional(),
  emailBilling: z.boolean().nullable().optional(),
  inAppMentions: z.boolean().nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    return dataResponse(await getNotificationSettings(orgId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = notificationsSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Notification payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await updateNotificationSettings({ orgId, ...parsed.data }));
  } catch (error) {
    return routeError(error);
  }
}
