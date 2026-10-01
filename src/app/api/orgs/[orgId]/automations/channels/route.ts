import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { createChannel, serializeChannel } from "@/lib/automations/channels";
import { automationError } from "@/lib/automations/manage-http";
import { channelSchema } from "@/lib/automations/schemas";

type RouteContext = { params: Promise<{ orgId: string }> };

/** Add a channel. A webhook's signing secret is returned once. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = channelSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Check the channel fields.", 422, parsed.error.flatten());
    const { channel, signingSecret } = await createChannel(orgId, user.id, parsed.data);
    return dataResponse({ channel: serializeChannel(channel), signingSecret }, { status: 201 });
  } catch (error) {
    return automationError(error);
  }
}
