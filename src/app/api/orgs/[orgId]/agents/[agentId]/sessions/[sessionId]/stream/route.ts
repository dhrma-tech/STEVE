import { errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isTerminalEvent } from "@/lib/agents/events";
import { getRun, getRunBySession, listEvents, onRunEvents } from "@/lib/agents/engine/run-store";
import { isTerminalStatus } from "@/lib/agents/engine/types";

type RouteContext = { params: Promise<{ orgId: string; agentId: string; sessionId: string }> };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no"
} as const;

const POLL_MS = 500;
const HEARTBEAT_MS = 15_000;

function sse(payload: unknown, id?: number): string {
  return `${id !== undefined ? `id: ${id}\n` : ""}data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Stream a session's events from its run's durable event log.
 *
 * The log is the source of truth, so the stream works no matter which server or worker process produced the events,
 * and a client that reconnects with `Last-Event-ID` (the browser does this by itself) or `?after=` continues where
 * it left off instead of losing what happened in between. Events written in this process wake the stream at once;
 * events written elsewhere are found by polling.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId, sessionId } = await context.params;
    await requireOrgMember(orgId);

    const session = await prisma.taskSession.findFirst({ where: { id: sessionId, organizationId: orgId } });
    if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);

    const url = new URL(request.url);
    const lastEventId = Number(request.headers.get("last-event-id") ?? url.searchParams.get("after") ?? 0);
    let cursor = Number.isFinite(lastEventId) && lastEventId > 0 ? lastEventId : 0;

    const run = await getRunBySession(sessionId);

    // Sessions from before durable runs have no event log: report their final state and stop.
    if (!run) {
      if (session.status === "completed" || session.status === "error" || session.status === "canceled") {
        const event =
          session.status === "completed"
            ? { type: "done", output: session.scratchpad ?? "" }
            : { type: "error", message: "This run has ended." };
        return new Response(sse(event), { headers: SSE_HEADERS });
      }
      return new Response(sse({ type: "connected", sessionId }), { headers: SSE_HEADERS });
    }

    const encoder = new TextEncoder();
    let closed = false;
    let wake: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const close = () => {
          if (closed) return;
          closed = true;
          unsubscribe?.();
          try { controller.close(); } catch { /* already closed */ }
        };
        request.signal.addEventListener("abort", close);
        unsubscribe = onRunEvents(run.id, () => wake?.());

        controller.enqueue(encoder.encode(sse({ type: "connected", sessionId })));

        // The loop runs detached so `start` returns at once and the first chunk reaches the client immediately.
        void (async () => {
        let lastBeat = Date.now();
        while (!closed) {
          const events = await listEvents(run.id, cursor);
          for (const event of events) {
            cursor = event.seq;
            const payload = { type: event.type, ...event.data };
            controller.enqueue(encoder.encode(sse(payload, event.seq)));
            lastBeat = Date.now();
            if (isTerminalEvent(payload)) return close();
          }
          if (events.length > 0) continue; // there may be more waiting

          // Nothing new. If the run already ended (for example before this client connected), say so and stop.
          const current = await getRun(run.id);
          if (!current || isTerminalStatus(current.status)) {
            const remaining = await listEvents(run.id, cursor, 1);
            if (remaining.length === 0) {
              if (current?.status === "completed") controller.enqueue(encoder.encode(sse({ type: "done", output: current.outputText })));
              else controller.enqueue(encoder.encode(sse({ type: "error", message: current?.errorMessage ?? "This run has ended." })));
              return close();
            }
            continue;
          }

          if (Date.now() - lastBeat > HEARTBEAT_MS) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
            lastBeat = Date.now();
          }
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, POLL_MS);
            wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          wake = null;
        }
        })().catch(() => close());
      },
      cancel() {
        closed = true;
        unsubscribe?.();
      }
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    return routeError(error);
  }
}
