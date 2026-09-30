import { getQueue } from "./queue";

/** Job type that moves a run forward by one step. */
export const ADVANCE_JOB = "run.advance";

type WakeListener = () => void;
const g = globalThis as typeof globalThis & { _steveWakeListeners?: Set<WakeListener> };
const listeners: Set<WakeListener> = (g._steveWakeListeners ??= new Set());

/** Workers in this process register here so new jobs are picked up immediately instead of on the next poll. */
export function onWake(listener: WakeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function wakeWorkers(): void {
  for (const listener of listeners) listener();
}

/**
 * Ask for a run to be advanced. Safe to call from anywhere and as often as you like: while an advance job is
 * already queued for the run, further calls do nothing, and a worker that finds the run busy retries later.
 */
export async function enqueueAdvance(runId: string, options: { delayMs?: number } = {}): Promise<void> {
  await getQueue().enqueue({
    type: ADVANCE_JOB,
    runId,
    payload: { runId },
    dedupeKey: `advance:${runId}`,
    runAt: options.delayMs ? new Date(Date.now() + options.delayMs) : undefined
  });
  wakeWorkers();
}
