import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getPreferencesSettings, updatePreferencesSettings } from "@/lib/settings/data";

const preferencesSchema = z.object({
  preferredName: z.string().trim().max(80).nullable().optional(),
  timezone: z.string().trim().max(80).nullable().optional(),
  theme: z.enum(["light", "system", "dark"]).nullable().optional(),
  shadowsEnabled: z.boolean().nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    return dataResponse(await getPreferencesSettings(orgId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = preferencesSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Preferences payload is invalid.", 422, parsed.error.flatten());
    }
    const { orgId } = await context.params;
    return dataResponse(await updatePreferencesSettings({ orgId, ...parsed.data }));
  } catch (error) {
    return routeError(error);
  }
}
