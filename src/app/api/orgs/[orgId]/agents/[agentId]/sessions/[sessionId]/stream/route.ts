import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { subscribe } from "@/lib/agents/event-bus";

type RouteContext = { params: Promise<{ orgId: string; agentId: string; sessionId: string }> };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no"
} as const;

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId, sessionId } = await context.params;
    await requireOrgMember(orgId);

    const session = await prisma.taskSession.findFirst({
      where: { id: sessionId, organizationId: orgId }
    });
    if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);

    const encoder = new TextEncoder();

    // If the session already finished before the client connected, return a
    // static SSE response so the client doesn't hang indefinitely.
    if (session.status === "completed" || session.status === "error") {
      const event = session.status === "completed"
        ? { type: "done", output: session.scratchpad ?? "" }
        : { type: "error", message: "Session ended before SSE connection opened" };
      return new Response(sseData(event), { headers: SSE_HEADERS });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Subscribe first, then check status — avoids a race where the runner
        // finishes just after the status check above but before subscribe().
        const unsubscribe = subscribe(sessionId, (event) => {
          try {
            controller.enqueue(encoder.encode(sseData(event)));
          } catch { /* client disconnected */ }

          if (event.type === "done" || event.type === "error") {
            unsubscribe();
            try { controller.close(); } catch { /* already closed */ }
          }
        });

        // Clean up if the client disconnects early
        request.signal.addEventListener("abort", () => {
          unsubscribe();
          try { controller.close(); } catch { /* already closed */ }
        });

        // Send initial ping so the client knows the connection is live
        controller.enqueue(encoder.encode(sseData({ type: "connected", sessionId })));
      }
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    return routeError(error);
  }
}
