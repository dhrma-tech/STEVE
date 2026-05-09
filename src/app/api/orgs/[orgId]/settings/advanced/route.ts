import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { getAdvancedSettings } from "@/lib/settings/data";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    return dataResponse(await getAdvancedSettings(orgId));
  } catch (error) {
    return routeError(error);
  }
}
