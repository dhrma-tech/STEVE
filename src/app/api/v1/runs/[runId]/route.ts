import { authenticateApiRequest } from "@/lib/automations/api-keys";
import { apiError, apiResponse } from "@/lib/automations/http";
import { apiGetRun } from "@/lib/automations/public-api";

type RouteContext = { params: Promise<{ runId: string }> };

/** A run's status, output, structured result, cost and direct delegates. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request, "runs:read");
    const { runId } = await context.params;
    return apiResponse(await apiGetRun(auth, runId));
  } catch (error) {
    return apiError(error);
  }
}
