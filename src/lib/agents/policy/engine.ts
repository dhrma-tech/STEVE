import type { PermissionMode } from "@/lib/agents/run-scope";
import { ALWAYS_ASK_RISKS, classifyToolCall, type ToolRisk } from "./risk";

export type PolicyAction = "allow" | "ask" | "deny";

export type PolicyDecision = {
  action: PolicyAction;
  risk: ToolRisk;
  reason: string;
};

/** Org-wide and per-agent rules merged. */
export type EffectivePolicy = {
  autoApprove: ReadonlySet<string>;
  alwaysAsk: ReadonlySet<string>;
};

export const EMPTY_POLICY: EffectivePolicy = { autoApprove: new Set(), alwaysAsk: new Set() };

/**
 * Decide what happens to one tool call. Pure: all inputs are passed in.
 *
 *   read, write_internal, delegate   allow                      (delegate is bounded by depth/cycle/budget limits)
 *   destructive, external_write      ask, unless pre-approved (run grant, agent rule, or trusted mode for external_write)
 *   external_comms, spend            ask every time; no grant or rule can waive this
 *   sandbox_only mode                deny destructive, external_* and spend
 *
 * The decision depends on the tool and its arguments only, never on text the model wrote,
 * so injected instructions cannot talk their way past it.
 *
 * `tainted`: the run read content that looked like a prompt injection (policy/injection.ts), or was started by an
 * outside event (a webhook trigger, src/lib/automations). From then on
 * nothing outside STEVE is pre-approved: run grants, agent auto-approve rules and trusted mode stop applying, and
 * every approval card says why.
 */
export function decide(params: {
  toolName: string;
  input: Record<string, unknown>;
  mode: PermissionMode;
  policy?: EffectivePolicy;
  grants?: ReadonlySet<string>;
  tainted?: boolean;
}): PolicyDecision {
  const decision = baseDecision(params);
  if (!params.tainted || decision.action === "deny" || decision.risk === "read" || decision.risk === "write_internal" || decision.risk === "delegate") {
    return decision;
  }
  return {
    action: "ask",
    risk: decision.risk,
    reason: `${decision.action === "ask" ? `${decision.reason} ` : ""}This run is working from outside content that may carry instructions (prompt injection risk), so outside actions need your approval.`
  };
}

function baseDecision(params: {
  toolName: string;
  input: Record<string, unknown>;
  mode: PermissionMode;
  policy?: EffectivePolicy;
  grants?: ReadonlySet<string>;
}): PolicyDecision {
  const { toolName, input, mode } = params;
  const policy = params.policy ?? EMPTY_POLICY;
  const grants = params.grants ?? new Set<string>();
  const risk = classifyToolCall(toolName, input);

  if (policy.alwaysAsk.has(toolName) && risk !== "read") {
    return { action: mode === "sandbox_only" ? "deny" : "ask", risk, reason: "This tool is set to always ask." };
  }

  if (risk === "read" || risk === "write_internal" || risk === "delegate") {
    return { action: "allow", risk, reason: "Low risk." };
  }

  if (mode === "sandbox_only") {
    return { action: "deny", risk, reason: "This agent is in read-only preview mode and cannot change anything outside STEVE." };
  }

  if (ALWAYS_ASK_RISKS.has(risk)) {
    return { action: "ask", risk, reason: risk === "spend" ? "Spends money or ships to production." : "Contacts people or publishes publicly." };
  }

  if (grants.has(toolName)) return { action: "allow", risk, reason: "Approved for this run." };
  if (policy.autoApprove.has(toolName)) return { action: "allow", risk, reason: "Always approved for this agent." };
  if (mode === "trusted" && risk === "external_write") {
    return { action: "allow", risk, reason: "Trusted workspace: external changes are allowed." };
  }

  return {
    action: "ask",
    risk,
    reason: risk === "destructive" ? "Irreversible action." : "Changes a third-party system."
  };
}
