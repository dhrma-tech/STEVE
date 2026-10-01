import { z } from "zod";
import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { buildChatMessageStream } from "@/lib/chat/streaming";
import { requireOrgWriter } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  fileIds: z.array(z.string().trim().min(1)).default([]),
  attachmentNames: z.array(z.string().trim().min(1).max(240)).default([]),
  mentions: z.array(z.string().trim().min(1).max(80)).default([])
});

type RouteContext = { params: Promise<{ orgId: string; threadId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = sendMessageSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Chat message payload is invalid.", 422, parsed.error.flatten());
    }

    const { orgId, threadId } = await context.params;
    // Checked before the stream opens, so a refused request gets a 401/403 instead of an error event.
    await requireOrgWriter(orgId);
    await enforceRateLimit("run_start", `org:${orgId}`);
    const stream = buildChatMessageStream({ orgId, threadId, ...parsed.data });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
