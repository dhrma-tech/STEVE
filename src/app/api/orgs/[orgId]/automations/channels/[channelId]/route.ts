import { dataResponse, errorResponse } from "@/lib/api/responses";
import { requireOrgAdmin } from "@/lib/auth/session";
import { deleteChannel, serializeChannel, updateChannel } from "@/lib/automations/channels";
import { automationError } from "@/lib/automations/manage-http";
import { channelPatchSchema } from "@/lib/automations/schemas";
import { audit } from "@/lib/security/audit";

type RouteContext = { params: Promise<{ orgId: string; channelId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { orgId, channelId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    const parsed = channelPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Check the channel fields.", 422, parsed.error.flatten());
    const channel = await updateChannel(orgId, channelId, parsed.data);
    if (channel) await audit({ orgId, actorUserId: user.id, action: "channel.updated", targetType: "channel", targetId: channel.id, metadata: { change: { ...parsed.data, url: parsed.data.url ? "(changed)" : undefined } } });
    return channel ? dataResponse({ channel: serializeChannel(channel) }) : errorResponse("NOT_FOUND", "Channel not found", 404);
  } catch (error) {
    return automationError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { orgId, channelId } = await context.params;
    const { user } = await requireOrgAdmin(orgId);
    if (!(await deleteChannel(orgId, channelId))) return errorResponse("NOT_FOUND", "Channel not found", 404);
    await audit({ orgId, actorUserId: user.id, action: "channel.deleted", targetType: "channel", targetId: channelId });
    return dataResponse({ deleted: true });
  } catch (error) {
    return automationError(error);
  }
}
