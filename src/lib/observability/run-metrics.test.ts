import { describe, expect, it } from "vitest";
import { percentile, summarizeUsage } from "./run-metrics";

describe("percentile", () => {
  it("uses the nearest rank and ignores input order", () => {
    const values = [500, 100, 300, 200, 400, 600, 700, 800, 900, 1000];
    expect(percentile(values, 50)).toBe(500);
    expect(percentile(values, 95)).toBe(1000);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 50)).toBeNull();
  });
});

describe("summarizeUsage", () => {
  it("sums cost and tokens per model, counts fallback turns and the cache hit rate", () => {
    const summary = summarizeUsage([
      { modelId: "claude-sonnet-5-5", requestedModelId: "claude-sonnet-5-5", costCents: 1, inputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheWriteTokens: 0 },
      { modelId: "claude-sonnet-5-5", requestedModelId: "claude-sonnet-5-5", costCents: 2, inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 900 },
      { modelId: "claude-opus-5-5", requestedModelId: "claude-sonnet-5-5", costCents: 5, inputTokens: 200, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 }
    ]);
    expect(summary.byModel.map((m) => [m.modelId, m.turns, m.costCents])).toEqual([
      ["claude-opus-5-5", 1, 5],
      ["claude-sonnet-5-5", 2, 3]
    ]);
    expect(summary.fallbackTurns).toBe(1);
    expect(summary.cacheHitRate).toBeCloseTo(900 / 2200);
  });

  it("copes with no usage and with malformed records", () => {
    expect(summarizeUsage([])).toEqual({ byModel: [], fallbackTurns: 0, cacheHitRate: null });
    expect(summarizeUsage([{}]).byModel).toEqual([expect.objectContaining({ modelId: "unknown", turns: 1, costCents: 0 })]);
  });
});
