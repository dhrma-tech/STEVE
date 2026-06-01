import type { AgentEvent } from "./runner";

type Subscriber = (event: AgentEvent) => void;

// Stored on globalThis so hot-reload in dev doesn't lose in-flight subscribers.
// Upgrade path: replace with Redis pub/sub for multi-process deployments.
const g = globalThis as typeof globalThis & { _steveAgentBus?: Map<string, Set<Subscriber>> };
const subs: Map<string, Set<Subscriber>> = (g._steveAgentBus ??= new Map());

/** Send an event to all current SSE subscribers for a session. */
export function publish(sessionId: string, event: AgentEvent): void {
  const set = subs.get(sessionId);
  if (!set) return;
  for (const cb of set) cb(event);
}

/**
 * Subscribe to events for a session.
 * Returns an unsubscribe function — call it when the SSE connection closes.
 */
export function subscribe(sessionId: string, cb: Subscriber): () => void {
  if (!subs.has(sessionId)) subs.set(sessionId, new Set());
  subs.get(sessionId)!.add(cb);
  return () => {
    const set = subs.get(sessionId);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) subs.delete(sessionId);
  };
}
