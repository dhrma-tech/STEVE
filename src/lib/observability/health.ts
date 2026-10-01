import { prisma } from "@/lib/db/client";

/**
 * System health for /api/health and the /status page (orchestration plan, Phase 10).
 *
 *   database  a round trip to Postgres
 *   workers   at least one worker swept within the last two minutes (WorkerHeartbeat)
 *   queue     the oldest job that is due and not yet taken (db queue only)
 *
 * No org data and no secrets: safe to expose publicly.
 */

export type ComponentStatus = "operational" | "degraded" | "down";

export type HealthReport = {
  status: ComponentStatus;
  checkedAt: string;
  components: {
    database: { status: ComponentStatus; latencyMs: number | null };
    workers: { status: ComponentStatus; alive: number; lastSeenAt: string | null };
    queue: { status: ComponentStatus; due: number | null; oldestDueSeconds: number | null };
  };
};

const WORKER_STALE_MS = 2 * 60 * 1000;
const QUEUE_SLOW_SECONDS = 5 * 60;

export async function recordWorkerHeartbeat(workerId: string, info: Record<string, unknown>): Promise<void> {
  const now = new Date();
  await prisma.workerHeartbeat.upsert({
    where: { id: workerId },
    update: { lastSeenAt: now, infoJson: JSON.stringify(info) },
    create: { id: workerId, lastSeenAt: now, infoJson: JSON.stringify(info) }
  });
  // Forget workers gone for a day.
  await prisma.workerHeartbeat.deleteMany({ where: { lastSeenAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
}

export async function getHealth(env: NodeJS.ProcessEnv = process.env): Promise<HealthReport> {
  const now = Date.now();
  let database: HealthReport["components"]["database"] = { status: "down", latencyMs: null };
  try {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - started;
    database = { status: latencyMs > 1000 ? "degraded" : "operational", latencyMs };
  } catch {
    return {
      status: "down",
      checkedAt: new Date(now).toISOString(),
      components: { database, workers: { status: "down", alive: 0, lastSeenAt: null }, queue: { status: "down", due: null, oldestDueSeconds: null } }
    };
  }

  const beats = await prisma.workerHeartbeat.findMany({ orderBy: { lastSeenAt: "desc" }, take: 20 });
  const alive = beats.filter((b) => now - b.lastSeenAt.getTime() < WORKER_STALE_MS).length;
  const workers = {
    status: (alive > 0 ? "operational" : "down") as ComponentStatus,
    alive,
    lastSeenAt: beats[0]?.lastSeenAt.toISOString() ?? null
  };

  let queue: HealthReport["components"]["queue"] = { status: "operational", due: null, oldestDueSeconds: null };
  if ((env.AGENT_QUEUE ?? "db") === "db") {
    const due = await prisma.job.count({ where: { status: "queued", runAt: { lte: new Date(now) } } });
    const oldest = await prisma.job.findFirst({ where: { status: "queued", runAt: { lte: new Date(now) } }, orderBy: { runAt: "asc" }, select: { runAt: true } });
    const oldestDueSeconds = oldest ? Math.round((now - oldest.runAt.getTime()) / 1000) : 0;
    queue = { status: oldestDueSeconds > QUEUE_SLOW_SECONDS ? "degraded" : "operational", due, oldestDueSeconds };
  }

  const statuses = [database.status, workers.status, queue.status];
  const status: ComponentStatus = statuses.includes("down") ? (database.status === "down" ? "down" : "degraded") : statuses.includes("degraded") ? "degraded" : "operational";
  return { status, checkedAt: new Date(now).toISOString(), components: { database, workers, queue } };
}
