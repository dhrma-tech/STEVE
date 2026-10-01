import { z } from "zod";

/**
 * The plan the Chief of Staff proposes with `propose_plan`: a dependency graph of steps, each owned by one agent.
 * Validation here is pure (no database); the store checks that owner slugs exist.
 */

export const MAX_PLAN_NODES = 20;
/** Used when the Chief of Staff gives no estimate for a step. */
export const DEFAULT_NODE_COST_CENTS = 40;
export const DEFAULT_NODE_MINUTES = 10;

const text = (max: number) => z.string().trim().max(max);
const KEY = /^[a-z0-9][a-z0-9-_]{0,47}$/;

export const planNodeInputSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(KEY, "use lowercase letters, digits and dashes, at most 48 characters"),
  title: text(120).min(1),
  description: text(4000).default(""),
  agentSlug: text(80).min(1),
  dependsOn: z.array(z.string().trim().toLowerCase()).max(MAX_PLAN_NODES).default([]),
  acceptanceCriteria: z.array(text(400).min(1)).max(10).default([]),
  review: z.boolean().optional(),
  estimatedCostCents: z.number().min(0).max(100_000).optional(),
  estimatedMinutes: z.number().int().min(0).max(60 * 24 * 14).optional(),
  riskNotes: text(600).optional()
});

export const planInputSchema = z.object({
  summary: text(2000).min(1),
  nodes: z.array(planNodeInputSchema).min(1).max(MAX_PLAN_NODES)
});

export type PlanNodeInput = z.infer<typeof planNodeInputSchema>;
export type PlanInput = z.infer<typeof planInputSchema>;

export type ParsedPlan = { ok: true; plan: PlanInput } | { ok: false; error: string };

/**
 * Validate a proposed plan: shape, unique keys, dependencies that exist and no cycles. `fixedKeys` are steps that
 * already exist and stay as they are (finished work kept by a revision); dependencies on them are allowed.
 */
export function parsePlanInput(input: unknown, fixedKeys: Iterable<string> = []): ParsedPlan {
  const parsed = planInputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
    return { ok: false, error: `propose_plan input is invalid (${issues}). Call propose_plan again with a valid plan.` };
  }
  const plan = parsed.data;
  const problems: string[] = [];

  const keys = new Set<string>();
  for (const node of plan.nodes) {
    if (keys.has(node.key)) problems.push(`step key "${node.key}" is used twice`);
    keys.add(node.key);
  }
  const known = new Set([...keys, ...fixedKeys]);
  for (const node of plan.nodes) {
    node.dependsOn = [...new Set(node.dependsOn)];
    for (const dep of node.dependsOn) {
      if (dep === node.key) problems.push(`step "${node.key}" depends on itself`);
      else if (!known.has(dep)) problems.push(`step "${node.key}" depends on unknown step "${dep}"`);
    }
  }
  if (problems.length === 0) {
    const cycle = findCycle(plan.nodes.map((node) => ({ key: node.key, dependsOn: node.dependsOn })));
    if (cycle) problems.push(`the dependencies form a loop: ${cycle.join(" -> ")}`);
  }
  if (problems.length > 0) {
    return { ok: false, error: `The plan has problems: ${problems.join("; ")}. Fix them and call propose_plan again.` };
  }
  return { ok: true, plan };
}

/** A dependency loop as a list of keys (first key repeated at the end), or null. Unknown keys are ignored. */
export function findCycle(nodes: Array<{ key: string; dependsOn: string[] }>): string[] | null {
  const deps = new Map(nodes.map((node) => [node.key, node.dependsOn]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (key: string): string[] | null => {
    if (state.get(key) === "done") return null;
    if (state.get(key) === "visiting") return [...stack.slice(stack.indexOf(key)), key];
    state.set(key, "visiting");
    stack.push(key);
    for (const dep of deps.get(key) ?? []) {
      if (!deps.has(dep)) continue;
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(key, "done");
    return null;
  };

  for (const node of nodes) {
    const cycle = visit(node.key);
    if (cycle) return cycle;
  }
  return null;
}

/** Elapsed time if every step starts as soon as its dependencies are done: the longest dependency chain. */
export function criticalPathMinutes(nodes: Array<{ key: string; dependsOn: string[]; minutes: number }>): number {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const memo = new Map<string, number>();
  const finish = (key: string, seen: Set<string>): number => {
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const node = byKey.get(key);
    if (!node || seen.has(key)) return 0;
    seen.add(key);
    const start = Math.max(0, ...node.dependsOn.map((dep) => finish(dep, seen)));
    seen.delete(key);
    const value = start + node.minutes;
    memo.set(key, value);
    return value;
  };
  return Math.max(0, ...nodes.map((node) => finish(node.key, new Set())));
}

export function parseKeys(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
