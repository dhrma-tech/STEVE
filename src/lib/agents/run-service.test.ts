import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, seedTask } from "@/lib/agents/testing/test-db";
import { AgentsPausedError } from "@/lib/agents/flags";
import { updatePolicy } from "@/lib/agents/policy/store";
import { getRunBySession } from "@/lib/agents/engine/run-store";
import { getQueue } from "@/lib/agents/engine/queue";
import { startAgentRun } from "@/lib/agents/run-service";

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);
vi.mock("@/lib/agents/prompt", () => ({
  buildPrompt: () => ({ system: "SYSTEM PROMPT", user: "USER PROMPT" }),
  loadOrgContext: async () => ({ businessPlan: "", brandKit: "" }),
  maybeExtractAndSaveBrandKit: async () => undefined
}));

const sessionStatus = async (id: string) => (await prisma.taskSession.findUnique({ where: { id } }))?.status;

async function engAgent(slug = "eng", extra: { isDefault?: boolean; departmentSlug?: string } = {}) {
  return seedAgent({ slug, name: "Engineering Agent", departmentSlug: extra.departmentSlug ?? "engineering", isDefault: extra.isDefault });
}

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(() => vi.unstubAllEnvs());

describe("startAgentRun", () => {
  it("creates a running session and a queued run, and a worker then finishes it", async () => {
    const agent = await engAgent();
    const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId });
    scriptedModel.load([{ text: "Implemented." }]);

    const session = await startAgentRun({ orgId: ORG, taskId: task.id });

    expect(session).not.toBeNull();
    expect(session!.agentId).toBe(agent.id);
    expect(session!.status).toBe("running"); // returned before any work happens
    expect(await prisma.task.findUnique({ where: { id: task.id } })).toMatchObject({ status: "running", agentId: agent.id });
    expect((await prisma.agentAction.findMany()).map((a) => a.actionType)).toContain("session.start");

    const run = (await getRunBySession(session!.id))!;
    expect(run).toMatchObject({ status: "queued", agentId: agent.id, taskId: task.id, requestText: "Queued task" });
    expect(await getQueue().hasPending(run.id)).toBe(true);
    expect(scriptedModel.calls).toHaveLength(0); // nothing ran inline

    await drainAll();

    expect(await sessionStatus(session!.id)).toBe("completed");
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.status).toBe("ready_to_review");
    expect((await prisma.agent.findUnique({ where: { id: agent.id } }))?.status).toBe("idle");
    expect(scriptedModel.calls).toHaveLength(1);
  });

  it("uses the caller's message as the request and the agent's permission mode for the run", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering", permissionMode: "sandbox_only" });
    const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId });

    const session = await startAgentRun({ orgId: ORG, taskId: task.id, message: "  Only touch the README  " });

    expect(await getRunBySession(session!.id)).toMatchObject({ requestText: "Only touch the README", mode: "sandbox_only" });
  });

  it("uses the agent the caller names over the task's agent", async () => {
    const owner = await engAgent();
    const other = await seedAgent({ slug: "mkt", name: "Marketing Agent", departmentSlug: "marketing" });
    const task = await seedTask({ agentId: owner.id, departmentId: owner.departmentId });

    const session = await startAgentRun({ orgId: ORG, taskId: task.id, agentId: other.id });

    expect(session!.agentId).toBe(other.id);
  });

  it("falls back to the department's default agent when the task has none", async () => {
    await engAgent("eng-extra");
    const dflt = await engAgent("eng-default", { isDefault: true });
    const task = await seedTask({ departmentId: dflt.departmentId });

    const session = await startAgentRun({ orgId: ORG, taskId: task.id });

    expect(session!.agentId).toBe(dflt.id);
  });

  it("returns null and changes nothing when no agent can run the task", async () => {
    const task = await seedTask({});

    expect(await startAgentRun({ orgId: ORG, taskId: task.id })).toBeNull();
    expect(await prisma.taskSession.count()).toBe(0);
    expect(await prisma.run.count()).toBe(0);
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.status).toBe("queued");
  });

  it("does not run tasks or agents from another organization", async () => {
    const agent = await engAgent();
    const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId });

    expect(await startAgentRun({ orgId: "org_other", taskId: task.id })).toBeNull();
    expect(await prisma.taskSession.count()).toBe(0);
  });

  it("throws AgentsPausedError and creates nothing while the kill switch is on", async () => {
    vi.stubEnv("AGENTS_PAUSED", "1");
    const agent = await engAgent();
    const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId });

    await expect(startAgentRun({ orgId: ORG, taskId: task.id })).rejects.toBeInstanceOf(AgentsPausedError);
    expect(await prisma.taskSession.count()).toBe(0);
    expect(await prisma.run.count()).toBe(0);
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.status).toBe("queued");
  });
});

describe("startAgentRun: organization limits", () => {
  async function queuedTask() {
    const agent = await engAgent();
    return seedTask({ agentId: agent.id, departmentId: agent.departmentId });
  }
  const usage = (costCents: number, sourceId: string | null, occurredAt = new Date()) =>
    prisma.usageRecord.create({
      data: { organizationId: ORG, category: "tokens", quantity: 1, unit: "tokens", costCents, sourceId, occurredAt }
    });

  it("refuses to start while the organization is paused", async () => {
    const task = await queuedTask();
    await updatePolicy(ORG, { agentsPaused: true });

    await expect(startAgentRun({ orgId: ORG, taskId: task.id })).rejects.toThrow(/paused for this organization/);
    expect(await prisma.taskSession.count()).toBe(0);
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.status).toBe("queued");
  });

  it("refuses to start once today's real agent spend reaches the daily budget", async () => {
    const task = await queuedTask();
    await updatePolicy(ORG, { dailyBudgetCents: 100 });
    await usage(60, "run:a");
    await usage(45, "run:b");

    await expect(startAgentRun({ orgId: ORG, taskId: task.id })).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("daily agent budget")
    });
    expect(await prisma.taskSession.count()).toBe(0);
  });

  it("ignores yesterday's spend and demo usage rows when checking the cap", async () => {
    const task = await queuedTask();
    await updatePolicy(ORG, { dailyBudgetCents: 100 });
    await usage(500, "run:old", new Date(Date.now() - 36 * 3_600_000));
    await usage(500, null); // sample data seeded by the billing page has no run: source

    expect(await startAgentRun({ orgId: ORG, taskId: task.id })).not.toBeNull();
  });

  it("uses the default daily budget when the organization sets none", async () => {
    const task = await queuedTask();
    await usage(1000, "run:big"); // default cap is 1000 cents

    await expect(startAgentRun({ orgId: ORG, taskId: task.id })).rejects.toMatchObject({ statusCode: 429 });
  });
});
