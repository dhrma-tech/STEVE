import { dataResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { testChannel } from "@/lib/automations/channels";
import { automationError } from "@/lib/automations/manage-http";

type RouteContext = { params: Promise<{ orgId: string; channelId: string }> };

/** Send a test message to the channel now. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orgId, channelId } = await context.params;
    await requireOrgAdmin(orgId);
    return dataResponse(await testChannel(orgId, channelId));
  } catch (error) {
    return automationError(error);
  }
}
