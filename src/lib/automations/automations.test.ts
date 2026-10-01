import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, testWorker } from "@/lib/agents/testing/test-db";
import { resetCircuits } from "@/lib/agents/engine/models";
import { listEvents } from "@/lib/agents/engine/run-store";
import { updatePolicy } from "@/lib/agents/policy/store";
import { decryptSecret, encryptSecret, hmacSha256Hex } from "@/lib/security/crypto";
import { createSchedule, fireDueSchedules, updateSchedule } from "./schedules";
import { createTrigger, receiveInbound } from "./triggers";
import { signBody, verifySignature } from "./inbound";
import { createChannel, deliverChannelJob, publishOrgEvent, DELIVER_JOB } from "./channels";
import { ApiAuthError, authenticateApiRequest, createApiKey, revokeApiKey } from "./api-keys";
import { apiGetRun, apiRunEvents, apiStartRun } from "./public-api";

const tools = vi.hoisted(() => ({ push: vi.fn(async () => "pushed") }));

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);
vi.mock("@/lib/agents/prompt", () => ({
  buildPrompt: () => ({ system: "SYSTEM PROMPT", user: "USER PROMPT" }),
  loadOrgContext: async () => ({ businessPlan: "", brandKit: "" }),
  maybeExtractAndSaveBrandKit: async () => undefined
}));
vi.mock("@/lib/agents/tools/registry", async () => {
  const s = { type: "string" };
  return {
    buildToolset: () => [
      {
        definition: { name: "github_push_file", description: "push", input_schema: { type: "object" as const, properties: { repo: s, path: s, content: s, message: s }, required: ["repo", "path", "content", "message"] } },
        execute: () => tools.push()
      }
    ]
  };
});

const push: ScriptedTurn = { toolCalls: [{ name: "github_push_file", input: { repo: "acme/site", path: "a.html", content: "x", message: "m" } }] };
const headers = (values: Record<string, string> = {}) => new Headers(values);

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  resetCircuits();
  tools.push.mockClear();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("stored secrets", () => {
  it("round-trips and refuses a tampered value", () => {
    const sealed = encryptSecret("https://hooks.slack.com/services/T/B/x");
    expect(sealed).toMatch(/^v1:/);
    expect(sealed).not.toContain("hooks.slack.com");
    expect(decryptSecret(sealed)).toBe("https://hooks.slack.com/services/T/B/x");
    const parts = sealed.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});

describe("schedules", () => {
  it("validates the cron, time zone and agent", async () => {
    await expect(createSchedule(ORG, null, { name: "x", cron: "61 * * * *", target: "goal", instruction: "Weekly report" })).rejects.toThrow(/outside 0-59/);
    await expect(createSchedule(ORG, null, { name: "x", cron: "0 9 * * 1", timezone: "Mars/Base", target: "goal", instruction: "Weekly report" })).rejects.toThrow(/time zone/);
    await expect(createSchedule(ORG, null, { name: "x", cron: "0 9 * * 1", target: "agent", instruction: "Weekly report" })).rejects.toThrow(/Pick the agent/);
    const schedule = await createSchedule(ORG, null, { name: "Weekly metrics", cron: "0 9 * * 1", timezone: "Asia/Kolkata", target: "goal", instruction: "Weekly metrics report" });
    expect(schedule.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("fires a due agent schedule once, even with two workers racing, and moves to the next slot", async () => {
    const agent = await seedAgent({ slug: "marketing-default", name: "Marketing Agent", departmentSlug: "marketing" });
    const schedule = await createSchedule(ORG, null, { name: "Daily post", cron: "0 9 * * *", target: "agent", agentId: agent.id, instruction: "Draft today's social post" });
    await prisma.schedule.update({ where: { id: schedule.id }, data: { nextRunAt: new Date(Date.now() - 1000) } });
    scriptedModel.load([{ text: "Drafted." }]);

    const [a, b] = await Promise.all([fireDueSchedules(), fireDueSchedules()]);
    expect(a + b).toBe(1);
    await drainAll();

    const fresh = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(fresh).toMatchObject({ lastStatus: "started", runCount: 1 });
    expect(fresh.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    const run = await prisma.run.findFirstOrThrow({ where: { agentId: agent.id } });
    expect(run).toMatchObject({ status: "completed", outputText: "Drafted." });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: run.taskId! } });
    expect(JSON.parse(task.metadataJson!)).toMatchObject({ source: "schedule", originId: schedule.id });
    // A schedule is the founder's own instruction: its run is not tainted.
    expect(JSON.parse(run.stateJson!).injectionSuspected ?? null).toBeNull();
  });

  it("gives a goal schedule to the Chief of Staff", async () => {
    await seedAgent({ slug: "marketing-default", name: "Marketing Agent", departmentSlug: "marketing" });
    const schedule = await createSchedule(ORG, null, { name: "Weekly metrics", cron: "@weekly", target: "goal", instruction: "Write the weekly metrics report" });
    await prisma.schedule.update({ where: { id: schedule.id }, data: { nextRunAt: new Date(Date.now() - 1000) } });
    expect(await fireDueSchedules()).toBe(1);
    const plan = await prisma.plan.findFirstOrThrow({ where: { organizationId: ORG } });
    expect(plan).toMatchObject({ goal: "Write the weekly metrics report", status: "drafting" });
    expect(JSON.parse((await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } })).lastRefJson!)).toMatchObject({ kind: "plan", planId: plan.id });
  });

  it("skips (and says so) while agents are paused, and the worker sweep fires schedules", async () => {
    const agent = await seedAgent({ slug: "marketing-default", name: "Marketing Agent", departmentSlug: "marketing" });
    const schedule = await createSchedule(ORG, null, { name: "Daily post", cron: "0 9 * * *", target: "agent", agentId: agent.id, instruction: "Draft today's post" });
    await prisma.schedule.update({ where: { id: schedule.id }, data: { nextRunAt: new Date(Date.now() - 1000) } });
    await updatePolicy(ORG, { agentsPaused: true });
    const stats = await testWorker().sweep();
    expect(stats.firedSchedules).toBe(1);
    expect(await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } })).toMatchObject({ lastStatus: "skipped", runCount: 0 });
    expect(await prisma.run.count()).toBe(0);
  });

  it("turning a schedule off clears its next run", async () => {
    const schedule = await createSchedule(ORG, null, { name: "x", cron: "0 9 * * *", target: "goal", instruction: "Weekly report" });
    const off = await updateSchedule(ORG, schedule.id, { enabled: false });
    expect(off).toMatchObject({ enabled: false, nextRunAt: null });
  });
});

describe("event triggers", () => {
  const stripeEvent = (id = "evt_1", type = "customer.created") =>
    JSON.stringify({ id, type, data: { object: { email: "new@customer.example", name: "Ada" } } });
  const stripeSigned = (body: string, secret: string) => {
    const t = Math.floor(Date.now() / 1000);
    return headers({ "stripe-signature": `t=${t},v1=${hmacSha256Hex(secret, `${t}.${body}`)}` });
  };

  async function setupTrigger(overrides: Partial<Parameters<typeof createTrigger>[2]> = {}) {
    const agent = await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering", permissionMode: "trusted" });
    const { trigger, token } = await createTrigger(ORG, null, {
      name: "New customer",
      source: "stripe",
      eventPattern: "customer.*",
      target: "agent",
      agentId: agent.id,
      instruction: "Welcome the new customer and set up their workspace.",
      signingSecret: "whsec_test_secret",
      ...overrides
    });
    return { agent, trigger, token };
  }

  it("starts the agent on a signed event, with the event as untrusted data and the run tainted", async () => {
    const { token, trigger } = await setupTrigger();
    scriptedModel.load([push, { text: "never reached" }]);
    const body = stripeEvent();
    const result = await receiveInbound({ token, headers: stripeSigned(body, "whsec_test_secret"), rawBody: body });
    expect(result).toEqual({ status: 200, body: { status: "fired", eventType: "customer.created" } });
    await drainAll();

    const run = await prisma.run.findFirstOrThrow();
    expect(run.requestText).toContain("<untrusted_content>");
    expect(run.requestText).toContain("new@customer.example");
    expect(JSON.parse(run.stateJson!).injectionSuspected).toMatchObject({ tool: "stripe webhook" });
    // A trusted agent would push without asking; work started by an outside event has to ask.
    expect(tools.push).not.toHaveBeenCalled();
    expect(run.status).toBe("waiting_approval");
    const approval = (await listEvents(run.id, 0)).find((e) => e.type === "approval_required");
    expect(String(approval?.data.reason)).toMatch(/outside content/);
    expect(await prisma.trigger.findUniqueOrThrow({ where: { id: trigger.id } })).toMatchObject({ fireCount: 1, lastStatus: "started" });
  });

  it("refuses bad signatures and unknown endpoints, and ignores repeats", async () => {
    const { token } = await setupTrigger();
    const body = stripeEvent();
    expect((await receiveInbound({ token: "nope-nope-nope-nope", headers: headers(), rawBody: body })).status).toBe(404);
    expect((await receiveInbound({ token: `${token.slice(0, 10)}xxxxxxxxxxxxxxxxxxxx`, headers: headers(), rawBody: body })).status).toBe(404);
    expect((await receiveInbound({ token, headers: stripeSigned(body, "whsec_wrong"), rawBody: body })).status).toBe(401);
    // A signature from long ago is refused even if it was valid then.
    const old = Math.floor(Date.now() / 1000) - 3600;
    const stale = headers({ "stripe-signature": `t=${old},v1=${hmacSha256Hex("whsec_test_secret", `${old}.${body}`)}` });
    expect((await receiveInbound({ token, headers: stale, rawBody: body })).status).toBe(401);

    scriptedModel.load([{ text: "Welcomed." }]);
    expect((await receiveInbound({ token, headers: stripeSigned(body, "whsec_test_secret"), rawBody: body })).body).toMatchObject({ status: "fired" });
    expect((await receiveInbound({ token, headers: stripeSigned(body, "whsec_test_secret"), rawBody: body })).body).toMatchObject({ status: "duplicate" });
    expect(await prisma.task.count()).toBe(1);
  });

  it("ignores events it is not subscribed to, and everything while switched off", async () => {
    const { token, trigger } = await setupTrigger();
    const invoice = stripeEvent("evt_2", "invoice.paid");
    expect((await receiveInbound({ token, headers: stripeSigned(invoice, "whsec_test_secret"), rawBody: invoice })).body).toMatchObject({ status: "ignored", reason: "event type not subscribed" });
    await prisma.trigger.update({ where: { id: trigger.id }, data: { enabled: false } });
    const customer = stripeEvent("evt_3");
    expect((await receiveInbound({ token, headers: stripeSigned(customer, "whsec_test_secret"), rawBody: customer })).body).toMatchObject({ status: "ignored", reason: "trigger is off" });
    expect(await prisma.run.count()).toBe(0);
    expect(await prisma.inboundEvent.count({ where: { status: "ignored" } })).toBe(2);
  });

  it("caps how often one trigger can start work in an hour", async () => {
    vi.stubEnv("TRIGGER_MAX_PER_HOUR", "2");
    const { token } = await setupTrigger({ signingSecret: null });
    const results = [];
    for (const id of ["a", "b", "c"]) {
      scriptedModel.load([{ text: "ok" }]);
      results.push((await receiveInbound({ token, headers: headers(), rawBody: stripeEvent(`evt_${id}`) })).body);
    }
    expect(results.map((r) => ("status" in r ? r.status : null))).toEqual(["fired", "fired", "ignored"]);
  });

  it("verifies GitHub, Sentry and STEVE-format signatures", () => {
    const body = '{"action":"opened"}';
    expect(verifySignature("github", headers({ "x-hub-signature-256": `sha256=${hmacSha256Hex("s", body)}` }), body, "s")).toBe(true);
    expect(verifySignature("github", headers({ "x-hub-signature-256": `sha256=${hmacSha256Hex("other", body)}` }), body, "s")).toBe(false);
    expect(verifySignature("sentry", headers({ "sentry-hook-signature": hmacSha256Hex("s", body) }), body, "s")).toBe(true);
    expect(verifySignature("webhook", headers({ "x-steve-signature": signBody("s", body) }), body, "s")).toBe(true);
    expect(verifySignature("webhook", headers({ "x-steve-signature": signBody("s", body) }), `${body} `, "s")).toBe(false);
  });

  it("hands a goal from an event to the Chief of Staff for review, never auto-approved", async () => {
    const { token } = await setupTrigger({ target: "goal", agentId: null, eventPattern: "*" });
    const body = stripeEvent("evt_goal");
    await receiveInbound({ token, headers: stripeSigned(body, "whsec_test_secret"), rawBody: body });
    const plan = await prisma.plan.findFirstOrThrow();
    expect(plan.autoApprove).toBe(false);
    const task = await prisma.task.findUniqueOrThrow({ where: { id: plan.taskId! } });
    expect(JSON.parse(task.metadataJson!)).toMatchObject({ origin: "trigger", untrusted: { tool: "stripe webhook" } });
  });
});

describe("outbound channels", () => {
  it("queues events only for subscribed channels and delivers a signed webhook", async () => {
    const { channel, signingSecret } = await createChannel(ORG, null, { kind: "webhook", name: "Ops", url: "https://ops.example.com/steve", events: ["run.failed"] });
    await createChannel(ORG, null, { kind: "slack", name: "Slack", url: "https://hooks.slack.com/services/T/B/x", events: ["approval.required"] });
    expect(signingSecret).toMatch(/^whsec_/);

    expect(await publishOrgEvent(ORG, "run.failed", { text: "Engineering failed", path: `/org/${ORG}/mission`, data: { runId: "r1" } })).toBe(1);
    const job = await prisma.job.findFirstOrThrow({ where: { type: DELIVER_JOB } });
    const payload = JSON.parse(job.payloadJson);
    expect(payload.channelId).toBe(channel.id);

    const sent: Array<{ url: string; init: RequestInit }> = [];
    const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(url), init: init! });
      return new Response("ok", { status: 200 });
    });
    await deliverChannelJob(payload, 1, 6, fetchStub as unknown as typeof fetch);
    expect(sent[0].url).toBe("https://ops.example.com/steve");
    const sentHeaders = sent[0].init.headers as Record<string, string>;
    expect(sentHeaders["x-steve-event"]).toBe("run.failed");
    const body = String(sent[0].init.body);
    expect(JSON.parse(body)).toMatchObject({ type: "run.failed", text: "Engineering failed", data: { runId: "r1" } });
    expect(verifySignature("webhook", new Headers(sentHeaders), body, signingSecret!)).toBe(true);
  });

  it("refuses non-Slack URLs for Slack and plain http in production", async () => {
    await expect(createChannel(ORG, null, { kind: "slack", name: "", url: "https://evil.example.com/x", events: ["run.failed"] })).rejects.toThrow(/hooks.slack.com/);
    vi.stubEnv("NODE_ENV", "production");
    await expect(createChannel(ORG, null, { kind: "webhook", name: "", url: "http://ops.example.com/x", events: ["run.failed"] })).rejects.toThrow(/https/);
    await expect(createChannel(ORG, null, { kind: "webhook", name: "", url: "https://10.0.0.5/x", events: ["run.failed"] })).rejects.toThrow(/Private network/);
  });

  it("retries a failing delivery and records the error when retries run out", async () => {
    const { channel } = await createChannel(ORG, null, { kind: "webhook", name: "Ops", url: "https://ops.example.com/steve", events: ["*"].concat("run.failed") });
    const failing = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const event = { id: "evt_x", type: "run.failed", organizationId: ORG, createdAt: new Date().toISOString(), text: "t", url: "u", data: {} };
    await expect(deliverChannelJob({ channelId: channel.id, event }, 1, 3, failing)).rejects.toThrow(/500/);
    expect((await prisma.notificationChannel.findUniqueOrThrow({ where: { id: channel.id } })).lastError).toBeNull();
    await expect(deliverChannelJob({ channelId: channel.id, event }, 3, 3, failing)).rejects.toThrow(/500/);
    expect(await prisma.notificationChannel.findUniqueOrThrow({ where: { id: channel.id } })).toMatchObject({ lastError: "webhook returned 500", failureCount: 1 });
  });

  it("sends approvals from a real run to Slack through the worker", async () => {
    const agent = await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering", permissionMode: "review_required" });
    await createChannel(ORG, null, { kind: "slack", name: "Slack", url: "https://hooks.slack.com/services/T/B/x", events: ["approval.required"] });
    const posted: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      posted.push(String(init?.body));
      return new Response("ok");
    }));
    scriptedModel.load([push, { text: "never reached" }]);
    const { startAgentRun } = await import("@/lib/agents/run-service");
    const task = await prisma.task.create({ data: { organizationId: ORG, agentId: agent.id, departmentId: agent.departmentId, title: "Push", type: "agent_task", status: "queued" } });
    await startAgentRun({ orgId: ORG, taskId: task.id, agentId: agent.id, message: "Push the page" });
    await drainAll();

    expect(posted).toHaveLength(1);
    const slack = JSON.parse(posted[0]);
    expect(slack.text).toMatch(/Approval needed \(external_write\): Push a\.html/);
    expect(slack.blocks[1].elements[0].url).toMatch(/mission\?tab=approvals$/);
  });
});

describe("public API", () => {
  const request = (key: string) => new Request("https://steve.example/api/v1/runs", { headers: { authorization: `Bearer ${key}` } });

  it("authenticates keys, enforces scopes and stops working once revoked", async () => {
    const { key, apiKey } = await createApiKey(ORG, null, "CI", ["runs:read"]);
    expect(key).toMatch(/^stv_/);
    expect(await prisma.apiKey.findFirst({ where: { keyHash: key } })).toBeNull(); // only the hash is stored
    await expect(authenticateApiRequest(request(key), "runs:read")).resolves.toMatchObject({ orgId: ORG });
    await expect(authenticateApiRequest(request(key), "runs:write")).rejects.toMatchObject({ status: 403 });
    await expect(authenticateApiRequest(request(`${key.slice(0, -1)}x`), "runs:read")).rejects.toBeInstanceOf(ApiAuthError);
    await expect(authenticateApiRequest(new Request("https://x"), "runs:read")).rejects.toMatchObject({ status: 401 });
    await revokeApiKey(ORG, apiKey.id);
    await expect(authenticateApiRequest(request(key), "runs:read")).rejects.toMatchObject({ status: 401 });
  });

  it("starts an agent run, reports its status and events, and keeps orgs apart", async () => {
    await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering" });
    await seedAgent({ slug: "other-agent", name: "Other", departmentSlug: "engineering", organizationId: "org_other" });
    const { key } = await createApiKey(ORG, null, "CI");
    const auth = await authenticateApiRequest(request(key), "runs:write");
    scriptedModel.load([{ text: "Release notes written." }]);

    const started = await apiStartRun(auth, { agent: "engineering-default", instruction: "Write the release notes" });
    expect(started).toMatchObject({ ok: true, status: 201 });
    await drainAll();
    const runId = started.ok && "run" in started.data ? started.data.run!.id : "";
    expect(await apiGetRun(auth, runId)).toMatchObject({ ok: true, data: { run: { status: "completed", output: "Release notes written." } } });
    const events = await apiRunEvents(auth, runId, 0);
    expect(events.ok && events.data.events.map((e) => e.type)).toContain("done");
    expect(await apiStartRun(auth, { agent: "other-agent", instruction: "Do something" })).toMatchObject({ ok: false, status: 404 });
    expect(await apiStartRun(auth, { instruction: "missing target" })).toMatchObject({ ok: false, status: 422 });

    const { key: otherKey } = await createApiKey("org_other", null, "Other");
    const otherAuth = await authenticateApiRequest(request(otherKey), "runs:read");
    expect(await apiGetRun(otherAuth, runId)).toMatchObject({ ok: false, status: 404 });
    expect(await apiRunEvents(otherAuth, runId, 0)).toMatchObject({ ok: false, status: 404 });
  });
});
