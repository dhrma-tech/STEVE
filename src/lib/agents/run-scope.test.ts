import { describe, expect, it } from "vitest";
import { RunBudget } from "@/lib/agents/policy/limits";
import { delegationBlockReason, parsePermissionMode, stricterMode, type RunScope } from "@/lib/agents/run-scope";

const limits = { maxDepth: 2, maxSteps: 60, maxToolCalls: 100, budgetCents: 200 };

/** A scope for an agent at the end of `chain` (root first). */
function scopeFor(chain: string[]): RunScope {
  return {
    tree: { rootRunId: "root", rootSessionId: "s-root", budget: new RunBudget(limits), grants: new Set() },
    depth: chain.length - 1,
    callChain: chain,
    mode: "trusted"
  };
}

describe("permission modes", () => {
  it("falls back to review_required for anything unrecognised", () => {
    expect(parsePermissionMode(undefined)).toBe("review_required");
    expect(parsePermissionMode("admin")).toBe("review_required");
    expect(parsePermissionMode("trusted")).toBe("trusted");
  });

  it("picks the more restrictive mode", () => {
    expect(stricterMode("trusted", "review_required")).toBe("review_required");
    expect(stricterMode("review_required", "sandbox_only")).toBe("sandbox_only");
    expect(stricterMode("trusted", "trusted")).toBe("trusted");
  });
});

describe("delegation guards", () => {
  it("blocks delegating to yourself", () => {
    expect(delegationBlockReason(scopeFor(["A"]), "A")).toMatch(/itself/);
  });

  it("blocks a loop back to an ancestor", () => {
    const b = scopeFor(["A", "B"]);
    expect(delegationBlockReason(b, "A")).toMatch(/loop/);
    expect(delegationBlockReason(b, "B")).toMatch(/itself/);
  });

  it("allows a new agent within the depth limit", () => {
    expect(delegationBlockReason(scopeFor(["A"]), "B")).toBeNull();
    expect(delegationBlockReason(scopeFor(["A", "B"]), "C")).toBeNull();
  });

  it("blocks delegation deeper than the limit", () => {
    // depth 0 = A, 1 = B, 2 = C (the limit): C may not delegate further
    expect(delegationBlockReason(scopeFor(["A", "B", "C"]), "D")).toMatch(/depth limit/);
  });
});
