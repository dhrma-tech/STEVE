import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgAdmin } from "@/lib/auth/session";
import { listAudit } from "@/lib/security/audit";

type RouteContext = { params: Promise<{ orgId: string }> };

/** The audit log, newest first. ?action=<prefix>&before=<ISO time>&limit=50 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgAdmin(orgId);
    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const entries = await listAudit(orgId, {
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      before: before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined,
      action: url.searchParams.get("action")?.trim() || undefined
    });
    return dataResponse({ entries });
  } catch (error) {
    return routeError(error);
  }
}
