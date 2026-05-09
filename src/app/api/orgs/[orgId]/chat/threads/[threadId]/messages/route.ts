import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { chatThreadNotFoundResponse, getChatThreadDetail, sendChatMessage } from "@/lib/chat/data";

const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  fileIds: z.array(z.string().trim().min(1)).default([]),
  attachmentNames: z.array(z.string().trim().min(1).max(240)).default([]),
  mentions: z.array(z.string().trim().min(1).max(80)).default([])
});

type RouteContext = { params: Promise<{ orgId: string; threadId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId, threadId } = await context.params;
    const thread = await getChatThreadDetail(orgId, threadId);
    return thread ? dataResponse(thread.messages) : chatThreadNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = sendMessageSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Chat message payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, threadId } = await context.params;
    const result = await sendChatMessage({ orgId, threadId, ...parsed.data });
    return result ? dataResponse(result, { status: 201 }) : chatThreadNotFoundResponse();
  } catch (error) {
    return routeError(error);
  }
}
