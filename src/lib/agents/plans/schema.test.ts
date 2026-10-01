import { describe, expect, it } from "vitest";
import { criticalPathMinutes, findCycle, parsePlanInput } from "./schema";

const node = (key: string, dependsOn: string[] = [], extra: Record<string, unknown> = {}) => ({
  key,
  title: `Step ${key}`,
  agentSlug: "eng",
  dependsOn,
  ...extra
});

describe("parsePlanInput", () => {
  it("accepts a valid graph and fills defaults", () => {
    const parsed = parsePlanInput({ summary: "Ship it", nodes: [node("build"), node("deploy", ["build"])] });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.plan.nodes[1]).toMatchObject({ key: "deploy", dependsOn: ["build"], acceptanceCriteria: [], description: "" });
  });

  it("normalizes keys and dependency references to lowercase", () => {
    const parsed = parsePlanInput({ summary: "x", nodes: [node("Build"), node("deploy", ["BUILD"])] });
    expect(parsed.ok && parsed.plan.nodes.map((n) => [n.key, n.dependsOn])).toEqual([["build", []], ["deploy", ["build"]]]);
  });

  it("reports duplicate keys, unknown and self dependencies together", () => {
    const parsed = parsePlanInput({ summary: "x", nodes: [node("a", ["a"]), node("a"), node("b", ["missing"])] });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('step key "a" is used twice');
    expect(parsed.error).toContain('step "a" depends on itself');
    expect(parsed.error).toContain('unknown step "missing"');
    expect(parsed.error).toContain("call propose_plan again");
  });

  it("rejects dependency loops", () => {
    const parsed = parsePlanInput({ summary: "x", nodes: [node("a", ["c"]), node("b", ["a"]), node("c", ["b"])] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/loop: a -> c -> b -> a/);
  });

  it("allows dependencies on steps kept from an earlier version", () => {
    expect(parsePlanInput({ summary: "x", nodes: [node("deploy", ["build"])] }, ["build"]).ok).toBe(true);
    expect(parsePlanInput({ summary: "x", nodes: [node("deploy", ["build"])] }).ok).toBe(false);
  });

  it("rejects bad shapes with the field that is wrong", () => {
    const parsed = parsePlanInput({ summary: "", nodes: [] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/summary|nodes/);
    const badKey = parsePlanInput({ summary: "x", nodes: [node("has spaces")] });
    expect(badKey.ok).toBe(false);
  });
});

describe("findCycle", () => {
  it("returns null for a DAG and ignores unknown keys", () => {
    expect(findCycle([{ key: "a", dependsOn: [] }, { key: "b", dependsOn: ["a", "zzz"] }])).toBeNull();
  });
});

describe("criticalPathMinutes", () => {
  it("is the longest dependency chain, not the sum", () => {
    expect(
      criticalPathMinutes([
        { key: "brand", dependsOn: [], minutes: 10 },
        { key: "copy", dependsOn: [], minutes: 30 },
        { key: "build", dependsOn: ["brand", "copy"], minutes: 20 },
        { key: "announce", dependsOn: ["build"], minutes: 5 }
      ])
    ).toBe(55);
  });
});
