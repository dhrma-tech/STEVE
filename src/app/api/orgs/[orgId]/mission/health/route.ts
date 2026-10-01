import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { getRunHealth } from "@/lib/observability/run-metrics";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Run health: success rate, durations, cost per run and by model, approval wait, replans, safety signals, recent runs. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    const days = Number(new URL(request.url).searchParams.get("days") ?? 7);
    return dataResponse(await getRunHealth(orgId, Number.isFinite(days) ? days : 7));
  } catch (error) {
    return routeError(error);
  }
}
