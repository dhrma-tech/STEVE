import { NextResponse } from "next/server";
import { getHealth } from "@/lib/observability/health";

export const dynamic = "force-dynamic";

/** Liveness and readiness: database, workers and queue. 503 when the database is down. */
export async function GET() {
  const health = await getHealth();
  return NextResponse.json(
    { data: { ok: health.status !== "down", ...health } },
    { status: health.status === "down" ? 503 : 200, headers: { "cache-control": "no-store" } }
  );
}
