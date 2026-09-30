import type { RunBudget } from "./policy/limits";

export type PermissionMode = "sandbox_only" | "review_required" | "trusted";

const STRICTNESS: Record<PermissionMode, number> = { sandbox_only: 0, review_required: 1, trusted: 2 };

export function parsePermissionMode(value: unknown): PermissionMode {
  return value === "sandbox_only" || value === "trusted" || value === "review_required" ? value : "review_required";
}

/** The more restrictive of two modes. A delegated agent can never be less restricted than its caller. */
export function stricterMode(a: PermissionMode, b: PermissionMode): PermissionMode {
  return STRICTNESS[a] <= STRICTNESS[b] ? a : b;
}

/** State shared by every agent in one run tree, loaded from the root run at the start of each step. */
export interface RunTree {
  rootRunId: string;
  rootSessionId: string;
  budget: RunBudget;
  /** Tools the human approved "for this run" (never contains communication or spend tools). */
  grants: Set<string>;
}

/** Where one agent sits inside a run tree. */
export interface RunScope {
  tree: RunTree;
  /** 0 for the root agent. */
  depth: number;
  /** Agent ids from the root down to this agent, inclusive. Used to stop delegation cycles. */
  callChain: string[];
  mode: PermissionMode;
}

/** Returns why an agent at `scope` may not delegate to `childAgentId`, or null when it may. */
export function delegationBlockReason(scope: RunScope, childAgentId: string): string | null {
  if (scope.callChain.includes(childAgentId)) {
    return scope.callChain[scope.callChain.length - 1] === childAgentId
      ? "An agent cannot delegate to itself. Do the work yourself or pick a different agent."
      : "That agent is already part of this delegation chain, so delegating to it would create a loop.";
  }
  const { maxDepth } = scope.tree.budget.limits;
  if (scope.depth + 1 > maxDepth) {
    return `Delegation depth limit reached (${maxDepth}). Finish this part yourself instead of delegating further.`;
  }
  return null;
}
