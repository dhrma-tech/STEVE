import pg from "pg";
import { prisma } from "./client";
import { databaseUrl } from "./url";

/**
 * Postgres LISTEN/NOTIFY between processes (web servers, standalone workers). Used to wake workers when a job is
 * queued and live streams when a run logs an event, wherever that happened. It only speeds things up: every
 * consumer also polls, so a lost notification or a dropped listener costs latency, never correctness.
 *
 * One dedicated connection per process, opened on the first subscription and reopened after errors.
 * PG_NOTIFY=off disables it (tests do, unless a test turns it on).
 */
type Handler = (payload: string) => void;

type State = {
  handlers: Map<string, Set<Handler>>;
  client: pg.Client | null;
  connecting: Promise<void> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
};

const g = globalThis as typeof globalThis & { _stevePgNotify?: State };
const state: State = (g._stevePgNotify ??= { handlers: new Map(), client: null, connecting: null, retryTimer: null });

export function notifyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.PG_NOTIFY?.trim().toLowerCase();
  if (value === "off" || value === "false" || value === "0") return false;
  if (value === "on" || value === "true" || value === "1") return true;
  return !env.VITEST;
}

/** Channel names are fixed identifiers (not user input), so quoting them is enough. */
const ident = (channel: string) => `"${channel.replace(/"/g, "")}"`;

async function connect(): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  client.on("notification", (message) => {
    for (const handler of state.handlers.get(message.channel) ?? []) {
      try {
        handler(message.payload ?? "");
      } catch {
        /* a bad handler must not break the others */
      }
    }
  });
  client.on("error", () => scheduleReconnect(client));
  client.on("end", () => scheduleReconnect(client));
  await client.connect();
  for (const channel of state.handlers.keys()) await client.query(`LISTEN ${ident(channel)}`);
  state.client = client;
}

function scheduleReconnect(dead: pg.Client) {
  if (state.client !== dead) return;
  state.client = null;
  dead.removeAllListeners();
  void dead.end().catch(() => undefined);
  if (state.retryTimer || state.handlers.size === 0) return;
  state.retryTimer = setTimeout(() => {
    state.retryTimer = null;
    void ensureConnected();
  }, 2000);
  state.retryTimer.unref?.();
}

function ensureConnected(): Promise<void> {
  if (state.client) return Promise.resolve();
  state.connecting ??= connect()
    .catch(() => {
      // Keep polling-only until the database is reachable again.
      if (!state.retryTimer && state.handlers.size > 0) {
        state.retryTimer = setTimeout(() => {
          state.retryTimer = null;
          void ensureConnected();
        }, 5000);
        state.retryTimer.unref?.();
      }
    })
    .finally(() => {
      state.connecting = null;
    });
  return state.connecting;
}

/** Subscribe to a channel. Returns an unsubscribe function. A no-op when notifications are disabled. */
export function listen(channel: string, handler: Handler): () => void {
  if (!notifyEnabled()) return () => undefined;
  let set = state.handlers.get(channel);
  const isNewChannel = !set;
  if (!set) {
    set = new Set();
    state.handlers.set(channel, set);
  }
  set.add(handler);
  if (state.client && isNewChannel) void state.client.query(`LISTEN ${ident(channel)}`).catch(() => undefined);
  else void ensureConnected();

  return () => {
    const current = state.handlers.get(channel);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      state.handlers.delete(channel);
      if (state.client) void state.client.query(`UNLISTEN ${ident(channel)}`).catch(() => undefined);
    }
  };
}

/** Tell every listening process. Failures are ignored: the listeners also poll. */
export async function notify(channel: string, payload = ""): Promise<void> {
  if (!notifyEnabled()) return;
  try {
    await prisma.$executeRaw`SELECT pg_notify(${channel}, ${payload})`;
  } catch {
    /* polling covers it */
  }
}

/** Close the listener connection (tests, shutdown). */
export async function closeNotify(): Promise<void> {
  if (state.retryTimer) clearTimeout(state.retryTimer);
  state.retryTimer = null;
  state.handlers.clear();
  const client = state.client;
  state.client = null;
  if (client) {
    client.removeAllListeners();
    await client.end().catch(() => undefined);
  }
}
