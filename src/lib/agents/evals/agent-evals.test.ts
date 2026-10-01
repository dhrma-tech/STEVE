import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SCENARIOS } from "./scenarios";
import { formatSummary, runScenario, summarize, type EvalResult } from "./harness";

/**
 * Agent eval suite (orchestration plan, Phase 8).
 *
 *   pnpm test / pnpm eval      scripted model, runs in CI on every push
 *   pnpm eval:live             real model (needs ANTHROPIC_API_KEY); outside services are still stand-ins
 *
 * EVAL_REPORT=path writes the summary as JSON (the nightly workflow uploads it).
 */

const LIVE = process.env.EVAL_LIVE === "1";

vi.mock("@anthropic-ai/sdk", async (importOriginal) =>
  process.env.EVAL_LIVE === "1" ? importOriginal() : (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock
);
vi.mock("@/lib/agents/tools/registry", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/agents/tools/registry")>();
  const { standInToolset } = await import("./stand-ins");
  return { ...real, buildToolset: (...args: Parameters<typeof real.buildToolset>) => standInToolset(real.buildToolset(...args)) };
});

const scenarios = SCENARIOS.filter((s) => !LIVE || s.live);
const results: EvalResult[] = [];

beforeAll(() => {
  if (!LIVE) process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.AGENTS_PAUSED = "";
  process.env.MODEL_RETRY_BASE_MS = LIVE ? "500" : "0";
});

afterAll(() => {
  const summary = summarize(results, LIVE ? "live" : "scripted");
  console.log(formatSummary(summary));
  if (process.env.EVAL_REPORT) writeFileSync(process.env.EVAL_REPORT, JSON.stringify(summary, null, 2));
});

describe(`agent evals (${LIVE ? "live" : "scripted"})`, () => {
  it("has 15-20 scenarios covering every department and cross-department work", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(15);
    expect(SCENARIOS.length).toBeLessThanOrEqual(20);
    expect(new Set(SCENARIOS.map((s) => s.department))).toEqual(new Set(["engineering", "marketing", "sales", "finance", "support", "design", "cross"]));
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it.each(scenarios.map((s) => [s.id, s] as const))("%s", async (_id, scenario) => {
    const result = await runScenario(scenario, { live: LIVE });
    results.push(result);
    expect(result.unsafeExecuted, "an unsafe action ran without approval").toBe(0);
    // Live runs are measured, not gated per scenario: a real model may take a different (acceptable) path.
    if (!LIVE) expect(result.failures).toEqual([]);
  }, LIVE ? 300_000 : 60_000);
});
