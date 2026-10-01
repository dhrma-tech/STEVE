import { prisma } from "@/lib/db/client";
import { log } from "@/lib/observability/log";
import { pruneRateLimits } from "./rate-limit";

/**
 * Data retention (orchestration plan, Phase 10). Runs from the worker sweep at most once an hour per process.
 *
 *   per org (Policy.retentionDays): run events of finished runs and inbound webhook events older than the setting
 *   always: finished jobs after 14 days, rate-limit windows after a day
 *
 * Runs, tasks, approvals, plans and the audit log are kept: they are the record of what happened. Deleting an org
 * removes everything (cascade).
 */

const FINISHED = ["completed", "failed", "cancelled"];
const JOB_KEEP_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
let lastRun = 0;

export type RetentionReport = { runEvents: number; inboundEvents: number; jobs: number; rateLimitWindows: number };

export async function applyRetention(now = new Date()): Promise<RetentionReport> {
  const report: RetentionReport = { runEvents: 0, inboundEvents: 0, jobs: 0, rateLimitWindows: 0 };
  const policies = await prisma.policy.findMany({
    where: { agentId: null, retentionDays: { not: null } },
    select: { organizationId: true, retentionDays: true }
  });
  for (const policy of policies) {
    const cutoff = new Date(now.getTime() - (policy.retentionDays ?? 0) * DAY_MS);
    const events = await prisma.runEvent.deleteMany({
      where: { createdAt: { lt: cutoff }, run: { organizationId: policy.organizationId, status: { in: FINISHED } } }
    });
    const inbound = await prisma.inboundEvent.deleteMany({ where: { organizationId: policy.organizationId, createdAt: { lt: cutoff } } });
    report.runEvents += events.count;
    report.inboundEvents += inbound.count;
  }
  const jobs = await prisma.job.deleteMany({
    where: { status: { in: ["done", "failed"] }, finishedAt: { lt: new Date(now.getTime() - JOB_KEEP_DAYS * DAY_MS) } }
  });
  report.jobs = jobs.count;
  report.rateLimitWindows = await pruneRateLimits(now);
  if (report.runEvents || report.inboundEvents || report.jobs) log.info("retention applied", report);
  return report;
}

/** applyRetention, at most once an hour in this process. */
export async function maybeApplyRetention(now = new Date()): Promise<RetentionReport | null> {
  if (now.getTime() - lastRun < 60 * 60 * 1000) return null;
  lastRun = now.getTime();
  return applyRetention(now);
}

export const RETENTION_CHOICES = [null, 7, 30, 90, 365] as const;

export async function getDataSettings(orgId: string) {
  const policy = await prisma.policy.findFirst({ where: { organizationId: orgId, agentId: null }, select: { retentionDays: true, redactPii: true } });
  return { retentionDays: policy?.retentionDays ?? null, redactPii: policy?.redactPii ?? false };
}

export async function updateDataSettings(orgId: string, patch: { retentionDays?: number | null; redactPii?: boolean }) {
  const data = {
    ...(patch.retentionDays !== undefined ? { retentionDays: patch.retentionDays } : {}),
    ...(patch.redactPii !== undefined ? { redactPii: patch.redactPii } : {})
  };
  const existing = await prisma.policy.findFirst({ where: { organizationId: orgId, agentId: null } });
  if (existing) await prisma.policy.update({ where: { id: existing.id }, data });
  else await prisma.policy.create({ data: { organizationId: orgId, agentId: null, ...data } });
  return getDataSettings(orgId);
}
