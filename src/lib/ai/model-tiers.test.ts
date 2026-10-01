import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, seedTask } from "@/lib/agents/testing/test-db";
import { startAgentRun } from "@/lib/agents/run-service";
import { getRun, getRunBySession, listEvents } from "@/lib/agents/engine/run-store";
import { estimateCostCents } from "@/lib/agents/policy/pricing";
import { resolveRunModel } from "./model-router";
import { bindsThinkingToConversation, supportsEffort, tierConfig } from "./model-tiers";

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);

const call = (name: string, input: Record<string, unknown> = {}): ScriptedTurn => ({ toolCalls: [{ name, input }] });

async function run(agentId: string, message = "Do the thing") {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const task = await seedTask({ agentId, departmentId: agent.departmentId, title: message });
  const session = (await startAgentRun({ orgId: ORG, taskId: task.id, agentId, message }))!;
  await drainAll();
  return (await getRunBySession(session.id))!;
}

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(() => vi.unstubAllEnvs());

describe("tiers", () => {
  it("maps work to the current models, with effort where the model takes it", () => {
    expect(tierConfig("planner")).toEqual({ tier: "planner", modelId: "claude-opus-5-5", effort: "high", fallbackModelId: "claude-sonnet-5-5" });
    expect(tierConfig("worker")).toMatchObject({ modelId: "claude-sonnet-5-5", effort: "medium" });
    expect(tierConfig("triage")).toMatchObject({ modelId: "claude-haiku-4-5", effort: null });
    expect(supportsEffort("claude-haiku-4-5")).toBe(false);
    expect(bindsThinkingToConversation("claude-sonnet-5-5")).toBe(true);
    expect(bindsThinkingToConversation("claude-haiku-4-5")).toBe(false);
  });

  it("is configured by environment, not code", () => {
    vi.stubEnv("MODEL_WORKER", "claude-opus-5-5");
    vi.stubEnv("MODEL_WORKER_EFFORT", "xhigh");
    vi.stubEnv("MODEL_WORKER_FALLBACK", "none");
    expect(tierConfig("worker")).toEqual({ tier: "worker", modelId: "claude-opus-5-5", effort: "xhigh", fallbackModelId: null });
    vi.stubEnv("MODEL_TRIAGE", "claude-haiku-4-5");
    vi.stubEnv("MODEL_TRIAGE_EFFORT", "high");
    expect(tierConfig("triage").effort).toBeNull(); // Haiku takes no effort, whatever the setting
  });

  it("picks the model from the agent's pin, then its tier, then the kind of run", () => {
    expect(resolveRunModel({ agentModel: "claude-sonnet-sandbox", agentTier: null, kind: "plan" })).toMatchObject({ modelId: "claude-opus-5-5", tier: "planner" });
    expect(resolveRunModel({ agentModel: "claude-sonnet-sandbox", agentTier: null, kind: "consult" })).toMatchObject({ modelId: "claude-haiku-4-5", tier: "triage" });
    expect(resolveRunModel({ agentModel: null, agentTier: "planner", kind: "task" })).toMatchObject({ modelId: "claude-opus-5-5" });
    expect(resolveRunModel({ agentModel: "claude-haiku-4-5", agentTier: "planner", kind: "plan" })).toMatchObject({ modelId: "claude-haiku-4-5", tier: null, effort: null });
    expect(resolveRunModel({ agentModel: "gpt-5.4-sandbox", agentTier: null, kind: "task" })).toMatchObject({ provider: "openai", modelId: "gpt-4o" });
    expect(resolveRunModel({ agentModel: "no-such-model", agentTier: null, kind: "task" })).toMatchObject({ modelId: "claude-sonnet-5-5" });
  });
});

describe("requests to Claude", () => {
  it("caches tools and system, sets effort, keeps thinking bound and asks for refusal fallbacks", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering" });
    scriptedModel.load([call("web_search", { query: "pricing pages" }), { text: "Done." }]);
    await run(agent.id);

    const [first, second] = scriptedModel.calls;
    const params = first!.params as {
      model: string;
      betas: string[];
      output_config: { effort: string };
      thinking: { type: string; block_binding: { prefix_mismatch_behavior: string } };
      context_management: { edits: Array<{ type: string }> };
      fallbacks: string;
      cache_control: unknown;
      system: Array<{ cache_control?: unknown }>;
      tools: Array<{ name: string; cache_control?: unknown }>;
    };
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.output_config).toEqual({ effort: "medium" });
    expect(params.thinking).toEqual({ type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } });
    expect(params.context_management.edits[0]!.type).toBe("clear_tool_uses_20250919");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(expect.arrayContaining(["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01", "context-management-2025-06-27"]));
    expect(params.cache_control).toEqual({ type: "ephemeral" });
    expect(params.system[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(params.tools.at(-1)!.cache_control).toEqual({ type: "ephemeral" });
    expect(params.tools.slice(0, -1).every((tool) => !tool.cache_control)).toBe(true);
    // The second turn sends the same system and tools (the cached prefix) and the history append-only.
    expect(JSON.stringify((second!.params as { system: unknown }).system)).toBe(JSON.stringify(params.system));
    expect(JSON.stringify((second!.params as { tools: unknown }).tools)).toBe(JSON.stringify(params.tools));
    expect(JSON.stringify(second!.messages).startsWith(JSON.stringify(first!.messages).slice(0, -1))).toBe(true);
  });

  it("sends Haiku no effort, thinking or fallbacks", async () => {
    const agent = await seedAgent({ slug: "fast", name: "Fast Agent", departmentSlug: "support" });
    await prisma.agent.update({ where: { id: agent.id }, data: { model: "claude-haiku-4-5" } });
    scriptedModel.load([{ text: "Quick answer." }]);
    await run(agent.id);
    const params = scriptedModel.calls[0]!.params;
    expect(params.model).toBe("claude-haiku-4-5");
    expect(params.output_config).toBeUndefined();
    expect(params.thinking).toBeUndefined();
    expect(params.fallbacks).toBeUndefined();
    expect(params.betas).toBeUndefined();
  });

  it("runs the Chief of Staff's planning on the planner tier", async () => {
    const { createGoalPlan } = await import("@/lib/agents/plans/store");
    await seedAgent({ slug: "ops", name: "Operations Agent", departmentSlug: "operations" });
    scriptedModel.route("Chief of Staff", [{ text: "thinking about it" }, { text: "still" }]);
    await createGoalPlan({ orgId: ORG, userId: null, goal: "Launch" });
    await drainAll();
    expect(scriptedModel.calls[0]!.params).toMatchObject({ model: "claude-opus-5-5", output_config: { effort: "high" } });
  });
});

describe("cost, refusals and outages", () => {
  it("prices the model that answered, counts cache tokens, and records usage per turn", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering" });
    scriptedModel.load([{ text: "Done.", servedModel: "claude-opus-5", usage: { input: 1000, output: 500 }, cache: { read: 20_000, write: 0 } }]);
    const finished = await run(agent.id);
    const expected = estimateCostCents({ modelId: "claude-opus-5", provider: "anthropic", inputTokens: 1000, outputTokens: 500, cacheReadTokens: 20_000 });
    expect(finished.costCents).toBeCloseTo(expected, 6);
    const usage = (await listEvents(finished.id, 0)).find((e) => e.type === "model_usage")!;
    expect(usage.data).toMatchObject({ modelId: "claude-opus-5", requestedModelId: "claude-sonnet-5-5", tier: "worker", cacheReadTokens: 20_000, toolCalls: [] });
    expect((await getRun(finished.id))!.tokensIn).toBe(21_000);
  });

  it("fails a run the model declines, with the category, and does not treat it as a bug", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering" });
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    scriptedModel.load([{ refusal: { category: "cyber", explanation: "Declined." } }]);
    const finished = await run(agent.id);
    expect(finished.status).toBe("failed");
    expect(finished.errorMessage).toContain("declined this request (cyber)");
    expect(errors).not.toHaveBeenCalled();
  });

  it("switches to the tier's fallback model when the primary is down", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering" });
    scriptedModel.load([
      { error: { status: 529, message: "overloaded" } },
      { error: { status: 529, message: "overloaded" } },
      { error: { status: 529, message: "overloaded" } },
      { text: "Answered by the fallback." }
    ]);
    const finished = await run(agent.id);
    expect(finished).toMatchObject({ status: "completed", outputText: "Answered by the fallback." });
    expect(scriptedModel.calls.map((c) => c.model)).toEqual(["claude-sonnet-5-5", "claude-sonnet-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
  });
});
