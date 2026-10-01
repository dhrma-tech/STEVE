import { enqueueJob } from "../engine/wake";

/** Job type that moves a plan forward: settle finished steps, start ready ones, replan or report. */
export const PLAN_JOB = "plan.advance";

/** Ask for a plan to be advanced. Cheap and idempotent: while one is queued for the plan, more calls do nothing. */
export async function enqueuePlanAdvance(planId: string, options: { delayMs?: number } = {}): Promise<void> {
  await enqueueJob({ type: PLAN_JOB, payload: { planId }, dedupeKey: `plan:${planId}` }, options);
}
