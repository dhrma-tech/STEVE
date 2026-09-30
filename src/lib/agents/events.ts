/** Everything a run reports while it works. Stored in the run's event log and streamed to the UI. */
export type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string; success: boolean }
  | {
      type: "approval_required";
      tool: string;
      input: unknown;
      approvalId: string;
      /** Risk class of the call (see policy/risk.ts). */
      risk?: string;
      /** One-line description of what will happen, safe to show in an approval card. */
      summary?: string;
      /** Why the policy is asking. */
      reason?: string;
    }
  | { type: "delegate_start"; childAgentSlug: string; childSessionId: string }
  | { type: "delegate_done"; childAgentSlug: string; output: string }
  | { type: "limit_reached"; limit: string; message: string }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

export type AgentEventType = AgentEvent["type"];

/** Events that end a run's stream. */
export function isTerminalEvent(event: { type: string }): boolean {
  return event.type === "done" || event.type === "error";
}

/** Events a person watching an ancestor run needs to see even though a delegated agent raised them. */
export function isForwardedEvent(event: { type: string }): boolean {
  return event.type === "approval_required" || event.type === "limit_reached";
}
