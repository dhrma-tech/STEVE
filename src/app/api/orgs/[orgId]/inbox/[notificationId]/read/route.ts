import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { getInboxItemsForUser, markInboxItemRead } from "@/lib/notifications/inbox";

type RouteContext = { params: Promise<{ orgId: string; notificationId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, notificationId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const item = await markInboxItemRead({ orgId, userId: user.id, notificationId: decodeURIComponent(notificationId) });

    if (!item) {
      return errorResponse("NOT_FOUND", "Notification was not found.", 404);
    }

    const inbox = await getInboxItemsForUser({ orgId, userId: user.id });
    return dataResponse({ item, unreadCount: inbox.unreadCount });
  } catch (error) {
    return routeError(error);
  }
}
