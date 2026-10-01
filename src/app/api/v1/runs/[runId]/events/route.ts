import { authenticateApiRequest } from "@/lib/automations/api-keys";
import { apiError, apiResponse } from "@/lib/automations/http";
import { apiRunEvents } from "@/lib/automations/public-api";

type RouteContext = { params: Promise<{ runId: string }> };

/** The run's event log after ?after=<seq> (default 0). Poll with the last seq you received. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request, "runs:read");
    const { runId } = await context.params;
    const url = new URL(request.url);
    return apiResponse(await apiRunEvents(auth, runId, Number(url.searchParams.get("after") ?? 0) || 0, Number(url.searchParams.get("limit") ?? 200) || 200));
  } catch (error) {
    return apiError(error);
  }
}
