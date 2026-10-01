/**
 * Structured logging for agent work: one JSON object per line with the ids that tie a line to a run
 * (runId, sessionId, orgId, jobId), so logs can be filtered by run in any log store.
 *
 *   LOG_FORMAT=json   (default in production) one JSON object per line
 *   LOG_FORMAT=pretty (default elsewhere)     "level message key=value ..."
 *   LOG_LEVEL=debug|info|warn|error           (default info; tests default to warn)
 *
 * Errors can also go to Sentry: set SENTRY_DSN and `reportError` posts an event through Sentry's HTTP envelope API
 * (no SDK needed). Reporting never throws and never blocks the caller for long.
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(env: NodeJS.ProcessEnv = process.env): number {
  const level = (env.LOG_LEVEL ?? (env.NODE_ENV === "test" || env.VITEST ? "warn" : "info")).toLowerCase() as Level;
  return ORDER[level] ?? ORDER.info;
}

function format(env: NodeJS.ProcessEnv = process.env): "json" | "pretty" {
  if (env.LOG_FORMAT === "json" || env.LOG_FORMAT === "pretty") return env.LOG_FORMAT;
  return env.NODE_ENV === "production" ? "json" : "pretty";
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 8).join("\n") };
  return { message: String(error) };
}

function write(level: Level, message: string, fields: Fields = {}) {
  if (ORDER[level] < threshold()) return;
  const clean = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value instanceof Error ? serializeError(value) : value])
  );
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (format() === "json") {
    sink(JSON.stringify({ time: new Date().toISOString(), level, msg: message, ...clean }));
  } else {
    const pairs = Object.entries(clean)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join(" ");
    sink(`[${level}] ${message}${pairs ? ` ${pairs}` : ""}`);
  }
}

export const log = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields)
};

// ── Sentry (optional) ─────────────────────────────────────────────────────────

type Dsn = { publicKey: string; host: string; projectId: string; protocol: string };

export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!url.username || !projectId) return null;
    return { publicKey: url.username, host: url.host, projectId, protocol: url.protocol.replace(":", "") };
  } catch {
    return null;
  }
}

/**
 * Log an error and, when SENTRY_DSN is set, send it to Sentry with the run's ids as tags. Resolves when done (or
 * after a short timeout); never rejects.
 */
export async function reportError(error: unknown, context: Fields = {}, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  log.error(error instanceof Error ? error.message : String(error), { ...context, error });
  const dsn = parseDsn(env.SENTRY_DSN);
  if (!dsn) return;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const err = serializeError(error);
  const tags = Object.fromEntries(Object.entries(context).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => [k, String(v)]));
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? "development",
    tags,
    extra: context,
    exception: { values: [{ type: err.name ?? "Error", value: err.message, stacktrace: undefined }] }
  };
  const body = [JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
  try {
    await fetch(`${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=steve/1.0, sentry_key=${dsn.publicKey}`
      },
      body,
      signal: AbortSignal.timeout(3000)
    });
  } catch {
    /* reporting must never fail the work */
  }
}
