import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { getInboxItemsForUser } from "@/lib/notifications/inbox";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const inbox = await getInboxItemsForUser({ orgId, userId: user.id });
    return dataResponse(inbox);
  } catch (error) {
    return routeError(error);
  }
}
