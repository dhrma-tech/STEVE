import { describe, expect, it } from "vitest";
import { defaultDailyBudgetCents, defaultLimits, LimitExceededError, RunBudget } from "@/lib/agents/policy/limits";
import { estimateCostCents, priceFor } from "@/lib/agents/policy/pricing";
import { capOutput, redactSecrets, sanitizeToolOutput } from "@/lib/agents/policy/sanitize";

const env = (values: Record<string, string | undefined>) => values as unknown as NodeJS.ProcessEnv;
const limits = { maxDepth: 3, maxSteps: 5, maxToolCalls: 4, budgetCents: 10 };

describe("limits from the environment", () => {
  it("uses safe defaults", () => {
    expect(defaultLimits(env({}))).toEqual({ maxDepth: 3, maxSteps: 60, maxToolCalls: 100, budgetCents: 200 });
    expect(defaultDailyBudgetCents(env({}))).toBe(1000);
  });

  it("reads overrides and ignores garbage", () => {
    expect(defaultLimits(env({ AGENT_MAX_DEPTH: "5", AGENT_RUN_BUDGET_CENTS: "50", AGENT_MAX_STEPS: "abc" }))).toMatchObject({
      maxDepth: 5,
      budgetCents: 50,
      maxSteps: 60
    });
  });
});

describe("RunBudget", () => {
  it("passes while under every limit", () => {
    const budget = new RunBudget(limits);
    budget.recordModelTurn({ modelId: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 1000, outputTokens: 500 });
    budget.recordToolCall();
    expect(() => budget.check()).not.toThrow();
    expect(budget.steps).toBe(1);
    expect(budget.toolCalls).toBe(1);
    expect(budget.totalTokens).toBe(1500);
  });

  it("stops at the step limit", () => {
    const budget = new RunBudget(limits);
    for (let i = 0; i < 5; i++) budget.recordModelTurn({ modelId: "local", provider: "ollama" });
    expect(() => budget.check()).toThrow(expect.objectContaining({ name: "LimitExceededError", limit: "steps" }));
  });

  it("stops at the tool-call limit", () => {
    const budget = new RunBudget(limits);
    for (let i = 0; i < 4; i++) budget.recordToolCall();
    expect(() => budget.recordToolCall()).toThrow(LimitExceededError);
    expect(budget.toolCalls).toBe(4);
  });

  it("stops once estimated spend reaches the budget", () => {
    const budget = new RunBudget(limits);
    // 1M output tokens on a sonnet-class model is $15 = 1500 cents, far over a 10 cent budget.
    budget.recordModelTurn({ modelId: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 0, outputTokens: 1_000_000 });
    expect(() => budget.check()).toThrow(expect.objectContaining({ limit: "budget" }));
  });

  it("does not charge for local models", () => {
    const budget = new RunBudget(limits);
    budget.recordModelTurn({ modelId: "mistral:latest", provider: "ollama", inputTokens: 9e6, outputTokens: 9e6 });
    expect(budget.spentCents).toBe(0);
  });
});

describe("pricing", () => {
  it("prices known model families and falls back to the most expensive tier", () => {
    expect(priceFor("claude-sonnet-4-6", "anthropic")).toMatchObject({ inputPerMTok: 3, outputPerMTok: 15 });
    expect(priceFor("claude-opus-5-5", "anthropic")).toMatchObject({ inputPerMTok: 4, outputPerMTok: 20, cacheReadPerMTok: 0.2 });
    expect(priceFor("claude-sonnet-5-5", "anthropic")).toMatchObject({ inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2 });
    expect(priceFor("claude-haiku-4-5", "anthropic")).toMatchObject({ inputPerMTok: 1, outputPerMTok: 5 });
    expect(priceFor("gpt-4o-mini", "openai").inputPerMTok).toBeLessThan(priceFor("gpt-4o", "openai").inputPerMTok);
    expect(priceFor("some-new-model", "anthropic")).toEqual(priceFor("claude-opus-9", "anthropic"));
  });

  it("converts tokens to cents", () => {
    const cents = estimateCostCents({ modelId: "claude-sonnet-4-6", provider: "anthropic", inputTokens: 1_000_000, outputTokens: 0 });
    expect(cents).toBeCloseTo(300);
  });

  it("prices cache reads and writes apart from fresh input", () => {
    const cached = estimateCostCents({ modelId: "claude-sonnet-5-5", provider: "anthropic", inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 });
    const written = estimateCostCents({ modelId: "claude-sonnet-5-5", provider: "anthropic", inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000 });
    expect(cached).toBeCloseTo(20); // $0.20 per MTok
    expect(written).toBeCloseTo(250); // 1.25 x $2
  });
});

describe("redactSecrets", () => {
  it("removes credential-shaped strings", () => {
    const text = [
      "key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123",
      "openai sk-proj-abcdefghijklmnopqrstuvwx",
      "gh ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "stripe sk_live_abcdefghij1234567890",
      "aws AKIAABCDEFGHIJKLMNOP",
      "header Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345"
    ].join("\n");
    const out = redactSecrets(text, env({}));
    expect(out).not.toMatch(/sk-ant-|sk-proj-|ghp_|sk_live_|AKIA|abcdefghijklmnopqrstuvwxyz012345/);
    expect(out.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("removes configured secret values wherever they appear", () => {
    const out = redactSecrets("token is hunter2-hunter2 ok", env({ GITHUB_TOKEN: "hunter2-hunter2" }));
    expect(out).toBe("token is [REDACTED] ok");
  });

  it("leaves ordinary text alone", () => {
    const text = "Deployed the pricing page. Task-123 is ready for review (sk is not a key).";
    expect(redactSecrets(text, env({}))).toBe(text);
  });
});

describe("capOutput and sanitizeToolOutput", () => {
  it("truncates long output and says so", () => {
    const out = capOutput("x".repeat(100), 40);
    expect(out.startsWith("x".repeat(40))).toBe(true);
    expect(out).toContain("60 more characters");
  });

  it("does not touch short output", () => {
    expect(capOutput("short", 40)).toBe("short");
  });

  it("redacts before capping", () => {
    const out = sanitizeToolOutput(`${"y".repeat(20)} sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123`);
    expect(out).not.toContain("sk-ant-");
  });
});
