import { authenticateApiRequest } from "@/lib/automations/api-keys";
import { apiError, apiResponse } from "@/lib/automations/http";
import { apiGetPlan } from "@/lib/automations/public-api";

type RouteContext = { params: Promise<{ planId: string }> };

/** A plan's status, steps and report. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request, "runs:read");
    const { planId } = await context.params;
    return apiResponse(await apiGetPlan(auth, planId));
  } catch (error) {
    return apiError(error);
  }
}
