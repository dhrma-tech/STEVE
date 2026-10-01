import type { Schedule } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { log } from "@/lib/observability/log";
import { cronError, describeCron, isValidTimeZone, nextRun } from "./cron";
import { startWork, type WorkTarget } from "./start-work";

/**
 * Schedules: recurring goals or agent instructions on a cron (orchestration plan, Phase 9).
 *
 * The worker's sweep calls `fireDueSchedules` about once a minute. Each due schedule is claimed by moving its
 * `nextRunAt` forward with a compare-and-set, so with several workers a firing happens once. A schedule that was due
 * while nothing was running fires once when the worker comes back, not once per missed slot.
 */

export type ScheduleInput = {
  name: string;
  cron: string;
  timezone?: string;
  target: WorkTarget;
  instruction: string;
  agentId?: string | null;
  autoApprove?: boolean;
  enabled?: boolean;
};

export class ScheduleError extends Error {}

async function validate(orgId: string, input: ScheduleInput) {
  const cronProblem = cronError(input.cron);
  if (cronProblem) throw new ScheduleError(cronProblem);
  const timezone = input.timezone?.trim() || "UTC";
  if (!isValidTimeZone(timezone)) throw new ScheduleError(`Unknown time zone: ${timezone}`);
  if (input.target === "agent") {
    if (!input.agentId) throw new ScheduleError("Pick the agent that should do this.");
    const agent = await prisma.agent.findFirst({ where: { id: input.agentId, organizationId: orgId }, select: { id: true } });
    if (!agent) throw new ScheduleError("Agent not found.");
  }
  if (!nextRun(input.cron, new Date(), timezone)) throw new ScheduleError("This schedule never comes round (check the day and month).");
  return { timezone };
}

export async function createSchedule(orgId: string, userId: string | null, input: ScheduleInput): Promise<Schedule> {
  const { timezone } = await validate(orgId, input);
  const enabled = input.enabled ?? true;
  return prisma.schedule.create({
    data: {
      organizationId: orgId,
      name: input.name.trim().slice(0, 120),
      cron: input.cron.trim(),
      timezone,
      target: input.target,
      instruction: input.instruction.trim().slice(0, 4000),
      agentId: input.target === "agent" ? input.agentId ?? null : null,
      autoApprove: input.target === "goal" && !!input.autoApprove,
      enabled,
      nextRunAt: enabled ? nextRun(input.cron, new Date(), timezone) : null,
      createdByUserId: userId
    }
  });
}

export async function updateSchedule(orgId: string, scheduleId: string, patch: Partial<ScheduleInput>): Promise<Schedule | null> {
  const current = await prisma.schedule.findFirst({ where: { id: scheduleId, organizationId: orgId } });
  if (!current) return null;
  const merged: ScheduleInput = {
    name: patch.name ?? current.name,
    cron: patch.cron ?? current.cron,
    timezone: patch.timezone ?? current.timezone,
    target: (patch.target ?? current.target) as WorkTarget,
    instruction: patch.instruction ?? current.instruction,
    agentId: patch.agentId !== undefined ? patch.agentId : current.agentId,
    autoApprove: patch.autoApprove ?? current.autoApprove,
    enabled: patch.enabled ?? current.enabled
  };
  const { timezone } = await validate(orgId, merged);
  const timingChanged = merged.cron !== current.cron || timezone !== current.timezone || merged.enabled !== current.enabled;
  return prisma.schedule.update({
    where: { id: current.id },
    data: {
      name: merged.name.trim().slice(0, 120),
      cron: merged.cron.trim(),
      timezone,
      target: merged.target,
      instruction: merged.instruction.trim().slice(0, 4000),
      agentId: merged.target === "agent" ? merged.agentId ?? null : null,
      autoApprove: merged.target === "goal" && !!merged.autoApprove,
      enabled: merged.enabled,
      ...(timingChanged ? { nextRunAt: merged.enabled ? nextRun(merged.cron, new Date(), timezone) : null } : {})
    }
  });
}

export async function deleteSchedule(orgId: string, scheduleId: string): Promise<boolean> {
  const { count } = await prisma.schedule.deleteMany({ where: { id: scheduleId, organizationId: orgId } });
  return count > 0;
}

export async function listSchedules(orgId: string) {
  const schedules = await prisma.schedule.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } });
  return schedules.map(serializeSchedule);
}

export function serializeSchedule(schedule: Schedule) {
  return {
    id: schedule.id,
    name: schedule.name,
    cron: schedule.cron,
    description: describeCron(schedule.cron),
    timezone: schedule.timezone,
    target: schedule.target as WorkTarget,
    instruction: schedule.instruction,
    agentId: schedule.agentId,
    autoApprove: schedule.autoApprove,
    enabled: schedule.enabled,
    nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
    lastStatus: schedule.lastStatus,
    lastMessage: schedule.lastMessage,
    lastRef: schedule.lastRefJson ? (JSON.parse(schedule.lastRefJson) as Record<string, string>) : null,
    runCount: schedule.runCount
  };
}

export type SerializedSchedule = ReturnType<typeof serializeSchedule>;

/** Start one firing of a schedule and record how it went. Used by the sweep and by "Run now". */
export async function fireSchedule(schedule: Schedule, now = new Date()) {
  try {
    const started = await startWork({
      orgId: schedule.organizationId,
      target: schedule.target as WorkTarget,
      instruction: schedule.instruction,
      agentId: schedule.agentId,
      title: schedule.name,
      autoApprove: schedule.autoApprove,
      userId: schedule.createdByUserId,
      context: `This is the scheduled run "${schedule.name}" (${describeCron(schedule.cron)}, ${schedule.timezone}).`,
      origin: { source: "schedule", refId: schedule.id }
    });
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        lastStatus: "started",
        lastMessage: started.kind === "plan" ? "The Chief of Staff is planning it." : "The agent started.",
        lastRefJson: JSON.stringify(started),
        runCount: { increment: 1 }
      }
    });
    log.info("schedule fired", { scheduleId: schedule.id, orgId: schedule.organizationId, ...started });
    return { ok: true as const, started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A pause or an exhausted budget skips this slot; anything else is a failure worth showing.
    const skipped = /paused|budget/i.test(message);
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, lastStatus: skipped ? "skipped" : "failed", lastMessage: message.slice(0, 500) }
    });
    log.warn("schedule did not start", { scheduleId: schedule.id, orgId: schedule.organizationId, reason: message });
    return { ok: false as const, error: message };
  }
}

/** Fire every enabled schedule that is due. Returns how many fired (started or not). */
export async function fireDueSchedules(now = new Date(), limit = 25): Promise<number> {
  const due = await prisma.schedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: limit
  });
  let fired = 0;
  for (const schedule of due) {
    const next = nextRun(schedule.cron, now, schedule.timezone);
    // Claim this slot: only the worker that moves nextRunAt from the value it read gets to fire.
    const { count } = await prisma.schedule.updateMany({
      where: { id: schedule.id, nextRunAt: schedule.nextRunAt },
      data: { nextRunAt: next }
    });
    if (count === 0) continue;
    await fireSchedule(schedule, now);
    fired += 1;
  }
  return fired;
}
