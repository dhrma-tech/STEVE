import { hmacSha256Hex, safeEqual, sha256Hex } from "@/lib/security/crypto";

/**
 * Inbound events: signature checks and normalisation per source (orchestration plan, Phase 9).
 *
 *   stripe   Stripe-Signature: t=<ts>,v1=<hmac of "<ts>.<body>">           (secret: the endpoint's whsec_...)
 *   github   X-Hub-Signature-256: sha256=<hmac of body>                     (secret: the webhook secret)
 *   sentry   Sentry-Hook-Signature: <hmac of body>                          (secret: the integration's client secret)
 *   support  Plain-Request-Signature: <hmac of body>, or the STEVE header below
 *   email, webhook (and any source)  X-Steve-Signature: t=<ts>,v1=<hmac of "<ts>.<body>">
 *
 * The signature is checked only when the trigger has a signing secret; the unguessable endpoint URL is always required.
 */

export const TRIGGER_SOURCES = ["stripe", "sentry", "github", "support", "email", "webhook"] as const;
export type TriggerSource = (typeof TRIGGER_SOURCES)[number];

export function isTriggerSource(value: unknown): value is TriggerSource {
  return typeof value === "string" && (TRIGGER_SOURCES as readonly string[]).includes(value);
}

/** Signed timestamps older than this are refused (replay protection on top of event-id dedupe). */
const TOLERANCE_SECONDS = 300;

type Headers = { get(name: string): string | null };

function timestampedHmacValid(header: string | null, body: string, secret: string, nowSeconds: number): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!t || !/^\d+$/.test(t) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = hmacSha256Hex(secret, `${t}.${body}`);
  return signatures.some((sig) => safeEqual(sig, expected));
}

/** True when the delivery carries a valid signature for `source`. */
export function verifySignature(source: TriggerSource, headers: Headers, body: string, secret: string, now = Date.now()): boolean {
  const nowSeconds = Math.floor(now / 1000);
  if (source === "stripe") return timestampedHmacValid(headers.get("stripe-signature"), body, secret, nowSeconds);
  if (source === "github") {
    const header = headers.get("x-hub-signature-256") ?? "";
    return header.startsWith("sha256=") && safeEqual(header.slice(7), hmacSha256Hex(secret, body));
  }
  if (source === "sentry") {
    const header = headers.get("sentry-hook-signature") ?? "";
    return !!header && safeEqual(header, hmacSha256Hex(secret, body));
  }
  if (source === "support" && headers.get("plain-request-signature")) {
    return safeEqual(headers.get("plain-request-signature") ?? "", hmacSha256Hex(secret, body));
  }
  return timestampedHmacValid(headers.get("x-steve-signature"), body, secret, nowSeconds);
}

/** The STEVE signature header for a body (outbound webhooks use the same scheme). */
export function signBody(secret: string, body: string, now = Date.now()): string {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${hmacSha256Hex(secret, `${t}.${body}`)}`;
}

export type NormalizedEvent = {
  /** e.g. customer.created, issue.created, pull_request.opened, workflow_run.completed, thread.created, email.received */
  type: string;
  /** The sender's id for this delivery; repeats are ignored. */
  externalId: string;
  /** One or two lines for people and for the agent's instruction. */
  summary: string;
};

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {});
const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined);
const join = (parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" · ").slice(0, 400);

function money(amount: unknown, currency: unknown): string | undefined {
  const cents = typeof amount === "number" ? amount : undefined;
  if (cents === undefined) return undefined;
  return `${(cents / 100).toFixed(2)} ${str(currency)?.toUpperCase() ?? ""}`.trim();
}

export function normalizeEvent(source: TriggerSource, headers: Headers, payload: unknown, rawBody: string): NormalizedEvent {
  const body = obj(payload);
  const fallbackId = `sha256:${sha256Hex(rawBody).slice(0, 32)}`;

  switch (source) {
    case "stripe": {
      const object = obj(obj(body.data).object);
      return {
        type: str(body.type) ?? "event",
        externalId: str(body.id) ?? fallbackId,
        summary: join([
          str(body.type),
          str(object.email) ?? str(obj(object.customer_details).email),
          str(object.name),
          money(object.amount_total ?? object.amount ?? object.amount_paid, object.currency),
          str(object.status),
          str(object.description)
        ])
      };
    }
    case "sentry": {
      const resource = headers.get("sentry-hook-resource") ?? "event";
      const data = obj(body.data);
      const issue = obj(data.issue ?? data.event ?? data.error);
      const action = str(body.action);
      return {
        type: action ? `${resource}.${action}` : resource,
        externalId: headers.get("request-id") ?? (str(issue.id) && action ? `${resource}:${str(issue.id)}:${action}` : fallbackId),
        summary: join([str(issue.title), str(issue.culprit), str(issue.level), str(obj(issue.project).slug ?? issue.project), str(issue.web_url ?? issue.url)])
      };
    }
    case "github": {
      const event = headers.get("x-github-event") ?? "event";
      const action = str(body.action);
      const repo = str(obj(body.repository).full_name);
      const pr = obj(body.pull_request);
      const run = obj(body.workflow_run ?? body.check_suite);
      const issue = obj(body.issue);
      return {
        type: action ? `${event}.${action}` : event,
        externalId: headers.get("x-github-delivery") ?? fallbackId,
        summary: join([
          repo,
          str(pr.title) && `PR #${str(pr.number)}: ${str(pr.title)}`,
          str(run.name) && `${str(run.name)}: ${str(run.conclusion) ?? str(run.status)}`,
          str(issue.title) && `Issue #${str(issue.number)}: ${str(issue.title)}`,
          str(pr.html_url) ?? str(run.html_url) ?? str(issue.html_url)
        ])
      };
    }
    case "support": {
      const thread = obj(body.thread ?? obj(body.payload).thread ?? body);
      const customer = obj(thread.customer ?? body.customer);
      return {
        type: str(body.type) ?? "thread.created",
        externalId: str(body.id) ?? fallbackId,
        summary: join([str(customer.email ?? obj(customer.email).email), str(thread.title), str(thread.previewText ?? body.text)?.slice(0, 200)])
      };
    }
    case "email": {
      return {
        type: str(body.type) ?? "email.received",
        externalId: str(body.messageId ?? body.message_id ?? obj(body.data).email_id) ?? fallbackId,
        summary: join([str(body.from ?? obj(body.data).from) && `From ${str(body.from ?? obj(body.data).from)}`, str(body.subject ?? obj(body.data).subject), str(body.text)?.slice(0, 200)])
      };
    }
    default:
      return {
        type: str(body.type ?? body.event) ?? "event",
        externalId: headers.get("x-event-id") ?? str(body.id) ?? fallbackId,
        summary: join([str(body.type ?? body.event), str(body.title ?? body.message ?? body.text)?.slice(0, 300)])
      };
  }
}

/** "*", an exact type, or a prefix pattern ("pull_request.*"); several separated by commas. */
export function eventMatches(pattern: string, type: string): boolean {
  return pattern
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .some((p) => p === "*" || p === type || (p.endsWith(".*") && type.startsWith(p.slice(0, -1))));
}
