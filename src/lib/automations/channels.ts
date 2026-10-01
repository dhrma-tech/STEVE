import type { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { enqueueJob } from "@/lib/agents/engine/wake";
import { appUrl } from "@/lib/agents/policy/one-tap";
import { log } from "@/lib/observability/log";
import { decryptSecret, encryptSecret, randomToken } from "@/lib/security/crypto";
import { signBody } from "./inbound";

/**
 * Outbound channels (orchestration plan, Phase 9): org events go to Slack (incoming webhook) and to signed HTTP
 * webhooks, besides the app and email.
 *
 * `publishOrgEvent` never blocks or fails the caller: it queues one delivery job per subscribed channel, and the
 * worker posts it with retries (see `deliverChannelJob`). Webhook bodies are signed like inbound ones:
 *   X-Steve-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">
 */

export const ORG_EVENT_TYPES = [
  "approval.required",
  "question.asked",
  "plan.proposed",
  "plan.finished",
  "run.completed",
  "run.failed",
  "briefing.ready"
] as const;
export type OrgEventType = (typeof ORG_EVENT_TYPES)[number];

export const EVENT_LABELS: Record<OrgEventType, string> = {
  "approval.required": "An action needs approval",
  "question.asked": "An agent asked a question",
  "plan.proposed": "A plan is ready for review",
  "plan.finished": "A plan finished",
  "run.completed": "A run finished",
  "run.failed": "A run failed",
  "briefing.ready": "The briefing is ready"
};

export const DELIVER_JOB = "channel.deliver";
const MAX_FAILURES_BEFORE_PAUSE = 20;

export type OrgEvent = {
  id: string;
  type: OrgEventType;
  organizationId: string;
  createdAt: string;
  /** One line for people. */
  text: string;
  /** Where to look in STEVE. */
  url: string;
  data: Record<string, unknown>;
};

const isEventType = (value: unknown): value is OrgEventType => typeof value === "string" && (ORG_EVENT_TYPES as readonly string[]).includes(value);

function parseEvents(json: string): string[] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Queue an org event for every enabled channel subscribed to it. Never throws: notifications must not affect the
 * work that produced them.
 */
export async function publishOrgEvent(orgId: string, type: OrgEventType, event: { text: string; path: string; data?: Record<string, unknown> }): Promise<number> {
  try {
    const channels = await prisma.notificationChannel.findMany({ where: { organizationId: orgId, enabled: true }, select: { id: true, eventsJson: true } });
    const subscribed = channels.filter((channel) => {
      const events = parseEvents(channel.eventsJson);
      return events.includes(type) || events.includes("*");
    });
    if (subscribed.length === 0) return 0;
    const payload: OrgEvent = {
      id: `evt_${randomToken(12)}`,
      type,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      text: event.text.slice(0, 500),
      url: `${appUrl()}${event.path}`,
      data: event.data ?? {}
    };
    for (const channel of subscribed) {
      await enqueueJob({ type: DELIVER_JOB, payload: { channelId: channel.id, event: payload }, maxAttempts: 6 });
    }
    return subscribed.length;
  } catch (error) {
    log.warn("could not queue org event", { orgId, type, error });
    return 0;
  }
}

// ── Managing channels ─────────────────────────────────────────────────────────

export class ChannelError extends Error {}

export type ChannelInput = { kind: "slack" | "webhook"; name: string; url: string; events: string[]; enabled?: boolean };

function checkUrl(kind: "slack" | "webhook", raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ChannelError("That is not a valid URL.");
  }
  const local = /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0|\[::1\])/.test(url.hostname);
  if (url.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")) throw new ChannelError("The URL must start with https://.");
  if (local && process.env.NODE_ENV === "production") throw new ChannelError("Private network addresses are not allowed.");
  if (kind === "slack" && url.hostname !== "hooks.slack.com") throw new ChannelError("A Slack channel needs an incoming webhook URL (https://hooks.slack.com/...).");
  return url;
}

const hint = (url: URL) => `${url.hostname}/…${url.pathname.slice(-6)}`;

export async function createChannel(orgId: string, userId: string | null, input: ChannelInput): Promise<{ channel: NotificationChannel; signingSecret: string | null }> {
  const url = checkUrl(input.kind, input.url);
  const events = input.events.filter(isEventType);
  if (events.length === 0) throw new ChannelError("Choose at least one event to send.");
  const signingSecret = input.kind === "webhook" ? `whsec_${randomToken(24)}` : null;
  const channel = await prisma.notificationChannel.create({
    data: {
      organizationId: orgId,
      kind: input.kind,
      name: input.name.trim().slice(0, 120) || (input.kind === "slack" ? "Slack" : "Webhook"),
      urlCiphertext: encryptSecret(url.toString()),
      urlHint: hint(url),
      secretCiphertext: signingSecret ? encryptSecret(signingSecret) : null,
      eventsJson: JSON.stringify(events),
      enabled: input.enabled ?? true,
      createdByUserId: userId
    }
  });
  return { channel, signingSecret };
}

export async function updateChannel(orgId: string, channelId: string, patch: { name?: string; events?: string[]; enabled?: boolean; url?: string }) {
  const current = await prisma.notificationChannel.findFirst({ where: { id: channelId, organizationId: orgId } });
  if (!current) return null;
  const events = patch.events?.filter(isEventType);
  if (events && events.length === 0) throw new ChannelError("Choose at least one event to send.");
  const url = patch.url ? checkUrl(current.kind as "slack" | "webhook", patch.url) : null;
  return prisma.notificationChannel.update({
    where: { id: current.id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 120) } : {}),
      ...(events ? { eventsJson: JSON.stringify(events) } : {}),
      // Turning a channel back on clears its failure streak.
      ...(patch.enabled !== undefined ? { enabled: patch.enabled, ...(patch.enabled ? { failureCount: 0, lastError: null } : {}) } : {}),
      ...(url ? { urlCiphertext: encryptSecret(url.toString()), urlHint: hint(url) } : {})
    }
  });
}

export async function deleteChannel(orgId: string, channelId: string): Promise<boolean> {
  const { count } = await prisma.notificationChannel.deleteMany({ where: { id: channelId, organizationId: orgId } });
  return count > 0;
}

export function serializeChannel(channel: NotificationChannel) {
  return {
    id: channel.id,
    kind: channel.kind as "slack" | "webhook",
    name: channel.name,
    urlHint: channel.urlHint,
    events: parseEvents(channel.eventsJson),
    enabled: channel.enabled,
    lastDeliveredAt: channel.lastDeliveredAt?.toISOString() ?? null,
    lastError: channel.lastError,
    failureCount: channel.failureCount
  };
}

export type SerializedChannel = ReturnType<typeof serializeChannel>;

export async function listChannels(orgId: string) {
  const channels = await prisma.notificationChannel.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } });
  return channels.map(serializeChannel);
}

// ── Delivery ──────────────────────────────────────────────────────────────────

function slackBody(event: OrgEvent) {
  return {
    text: `${event.text} — ${event.url}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${EVENT_LABELS[event.type] ?? event.type}*\n${event.text}` } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open in STEVE" }, url: event.url }] }
    ]
  };
}

/** Post one event to one channel. Throws on failure so the job is retried. */
export async function deliverToChannel(channel: NotificationChannel, event: OrgEvent, fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = decryptSecret(channel.urlCiphertext);
  const body = JSON.stringify(channel.kind === "slack" ? slackBody(event) : event);
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "STEVE-Webhooks/1" };
  if (channel.kind === "webhook") {
    headers["x-steve-event"] = event.type;
    headers["x-steve-delivery"] = event.id;
    if (channel.secretCiphertext) headers["x-steve-signature"] = signBody(decryptSecret(channel.secretCiphertext), body);
  }
  const response = await fetchImpl(url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000), redirect: "manual" });
  if (!response.ok) throw new Error(`${channel.kind} returned ${response.status}`);
}

/** Worker handler for DELIVER_JOB. */
export async function deliverChannelJob(payload: unknown, attempt: number, maxAttempts: number, fetchImpl: typeof fetch = fetch): Promise<void> {
  const { channelId, event } = (payload ?? {}) as { channelId?: string; event?: OrgEvent };
  if (!channelId || !event) return;
  const channel = await prisma.notificationChannel.findUnique({ where: { id: channelId } });
  if (!channel || !channel.enabled) return; // deleted or turned off since: nothing to do
  try {
    await deliverToChannel(channel, event, fetchImpl);
    await prisma.notificationChannel.update({ where: { id: channel.id }, data: { lastDeliveredAt: new Date(), lastError: null, failureCount: 0 } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attempt >= maxAttempts) {
      // Out of retries: record it, and turn a channel that keeps failing off instead of retrying forever.
      const failureCount = channel.failureCount + 1;
      await prisma.notificationChannel.update({
        where: { id: channel.id },
        data: { lastError: message.slice(0, 300), failureCount, ...(failureCount >= MAX_FAILURES_BEFORE_PAUSE ? { enabled: false } : {}) }
      });
    }
    throw error;
  }
}

/** Send a test event to a channel right away. */
export async function testChannel(orgId: string, channelId: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  const channel = await prisma.notificationChannel.findFirst({ where: { id: channelId, organizationId: orgId } });
  if (!channel) return { ok: false, error: "Channel not found." };
  const event: OrgEvent = {
    id: `evt_test_${randomToken(8)}`,
    type: "run.completed",
    organizationId: orgId,
    createdAt: new Date().toISOString(),
    text: "Test message from STEVE: this channel is connected.",
    url: `${appUrl()}/org/${orgId}/mission`,
    data: { test: true }
  };
  try {
    await deliverToChannel(channel, event, fetchImpl);
    await prisma.notificationChannel.update({ where: { id: channel.id }, data: { lastDeliveredAt: new Date(), lastError: null } });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.notificationChannel.update({ where: { id: channel.id }, data: { lastError: message.slice(0, 300) } });
    return { ok: false, error: message };
  }
}
