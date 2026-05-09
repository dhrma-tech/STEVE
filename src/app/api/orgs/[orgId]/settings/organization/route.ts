import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getOrganizationSettings, updateOrganizationSettings } from "@/lib/settings/data";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    return dataResponse(await getOrganizationSettings(orgId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = orgSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Organization payload is invalid.", 422, parsed.error.flatten());
    const { orgId } = await context.params;
    return dataResponse(await updateOrganizationSettings({ orgId, ...parsed.data }));
  } catch (error) {
    return routeError(error);
  }
}
