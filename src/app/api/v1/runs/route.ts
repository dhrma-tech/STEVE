import { authenticateApiRequest } from "@/lib/automations/api-keys";
import { apiError, apiResponse } from "@/lib/automations/http";
import { apiListRuns, apiStartRun } from "@/lib/automations/public-api";

/** Recent top-level runs. ?status=running&limit=20 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, "runs:read");
    const url = new URL(request.url);
    return apiResponse(await apiListRuns(auth, { limit: Number(url.searchParams.get("limit") ?? 20) || 20, status: url.searchParams.get("status") }));
  } catch (error) {
    return apiError(error);
  }
}

/** Start work: { agent, instruction, title? } runs one agent; { goal, context? } asks the Chief of Staff for a plan. */
export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, "runs:write");
    return apiResponse(await apiStartRun(auth, await request.json().catch(() => null)));
  } catch (error) {
    return apiError(error);
  }
}
