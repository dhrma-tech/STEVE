import { AppError } from "@/lib/utils/error";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function isOn(value: string | undefined): boolean {
  return TRUTHY.has((value ?? "").trim().toLowerCase());
}

/** Gate for the v2 orchestrator (durable runs, policy engine). Off by default. */
export function isOrchestratorV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isOn(env.ORCHESTRATOR_V2);
}

/** Global kill switch: while on, no agent run may start or continue. */
export function isAgentExecutionPaused(env: NodeJS.ProcessEnv = process.env): boolean {
  return isOn(env.AGENTS_PAUSED);
}

export class AgentsPausedError extends AppError {
  constructor(message = "Agent execution is paused by an administrator (AGENTS_PAUSED).") {
    super(message, 503, "INTERNAL");
    this.name = "AgentsPausedError";
  }
}

export function assertAgentsNotPaused(env: NodeJS.ProcessEnv = process.env): void {
  if (isAgentExecutionPaused(env)) throw new AgentsPausedError();
}
