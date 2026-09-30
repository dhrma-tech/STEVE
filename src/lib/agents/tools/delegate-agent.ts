import type { AgentTool } from "./types";

/**
 * Delegation is carried out by the run engine (engine/advance.ts), not by this tool: it starts the other agent
 * as its own durable run, and this run waits for it in the database. The definition here is what the model sees.
 * `execute` exists only to satisfy the tool interface and is never called by the engine.
 */
export const delegateAgentTool: AgentTool = {
  definition: {
    name: "delegate_agent",
    description:
      "Delegate a sub-task to another agent in the organization. The other agent runs on its own and its result comes back to you. " +
      "An agent cannot delegate to itself or to an agent already in the chain, delegation depth is limited, and the delegated " +
      "agent is never less restricted than you are.",
    input_schema: {
      type: "object",
      properties: {
        agentSlug: { type: "string", description: "Slug of the target agent to delegate to" },
        task: { type: "string", description: "Full description of the task for the child agent" }
      },
      required: ["agentSlug", "task"]
    }
  },

  async execute() {
    return "Error: delegation is handled by the run engine and cannot be called directly.";
  }
};
