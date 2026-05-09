import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { chatThreadNotFoundResponse, getChatThreadDetail, updateChatThread } from "@/lib/chat/data";

const updateThreadSchema = z.object({
  title: z.string().trim().max(180).nullable().optional(),
  archived: z.boolean().nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string; threadId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, threadId } = await context.params;
    const thread = await getChatThreadDetail(orgId, threadId);
    return thread ? dataResponse(thread) : chatThreadNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const parsed = updateThreadSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Chat thread update is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, threadId } = await context.params;
    const thread = await updateChatThread({ orgId, threadId, ...parsed.data });
    return thread ? dataResponse(thread) : chatThreadNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}
