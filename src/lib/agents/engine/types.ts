import type { ToolRisk } from "../policy/risk";

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "waiting_children"
  | "completed"
  | "failed"
  | "cancelled";

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "failed", "cancelled"]);
export const ACTIVE_STATUSES: readonly RunStatus[] = ["queued", "running", "waiting_approval", "waiting_children"];

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export type ProviderId = "anthropic" | "openai" | "ollama";

/**
 * One tool call the model asked for, and where it stands. A turn's calls are the "slots" the run works
 * through; the run only asks the model for its next turn once every slot is done.
 */
export type SlotStatus = "pending" | "executing" | "waiting_approval" | "waiting_child" | "done";

export interface Slot {
  /** The provider's tool-call id. */
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: SlotStatus;
  /** Already counted against the run tree's tool-call limit (so resuming does not count it twice). */
  counted?: boolean;
  risk?: ToolRisk;
  approvalId?: string;
  /** A human approved this call: run it without asking again. */
  approved?: boolean;
  actionId?: string;
  idempotencyKey?: string | null;
  childRunId?: string;
  childAgentSlug?: string;
  output?: string;
  success?: boolean;
}

/** Everything needed to continue a run in another process. Stored in Run.stateJson. */
export interface RunState {
  provider: ProviderId;
  modelId: string;
  system: string;
  user: string;
  skillKeys: string[];
  /** Provider-native message history (Anthropic or OpenAI format). Empty for the local model. */
  messages: unknown[];
  /** Tool calls of the current turn, or null when the run is between turns. */
  pending: Slot[] | null;
}

export type AdvanceResult =
  /** Progress was made and more can be done without waiting for anything. */
  | "more"
  /** The run is waiting for an approval or a child run. Something else will wake it. */
  | "waiting"
  | "finished"
  /** Another worker holds the run. */
  | "busy"
  | "gone";
