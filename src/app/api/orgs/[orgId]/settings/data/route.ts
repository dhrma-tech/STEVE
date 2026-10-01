import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/security/audit";
import { forgetPiiSetting } from "@/lib/security/pii";
import { getDataSettings, updateDataSettings } from "@/lib/security/retention";

const patchSchema = z.object({
  retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).nullable().optional(),
  redactPii: z.boolean().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

/** Data retention and personal-data redaction for stored agent activity. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgAdmin(orgId);
    return dataResponse(await getDataSettings(orgId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Retention is 7, 30, 90 or 365 days, or null to keep everything.", 422, parsed.error.flatten());
    const settings = await updateDataSettings(orgId, parsed.data);
    forgetPiiSetting(orgId);
    await audit({ orgId, actorUserId: user.id, action: "data_settings.updated", targetType: "organization", targetId: orgId, metadata: { change: parsed.data } });
    return dataResponse(settings);
  } catch (error) {
    return routeError(error);
  }
}
