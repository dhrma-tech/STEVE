import { timingSafeEqual } from "node:crypto";
import { errorResponse, dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { Worker } from "@/lib/agents/engine/worker";

/**
 * Work through due agent jobs for up to ~50 seconds, then return. For hosts without a long-running process
 * (serverless): call this every minute from a scheduler with `Authorization: Bearer $WORKER_TICK_SECRET`.
 * Disabled (404) until WORKER_TICK_SECRET is set.
 */
export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const secret = process.env.WORKER_TICK_SECRET;
    if (!secret) return errorResponse("NOT_FOUND", "Not found", 404);
    if (!authorized(request, secret)) return errorResponse("UNAUTHENTICATED", "Invalid token", 401);

    const worker = new Worker({ id: `tick-${Date.now()}` });
    const sweep = await worker.sweep();
    const handled = await worker.drain({ maxMs: 50_000 });
    return dataResponse({ handled, sweep });
  } catch (error) {
    return routeError(error);
  }
}
