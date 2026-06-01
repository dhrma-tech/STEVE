import type { AgentTool } from "./types";

export const delegateAgentTool: AgentTool = {
  definition: {
    name: "delegate_agent",
    description: "Delegate a sub-task to another agent in the organization. The child agent runs autonomously and returns its output.",
    input_schema: {
      type: "object",
      properties: {
        agentSlug: { type: "string", description: "Slug of the target agent to delegate to" },
        task: { type: "string", description: "Full description of the task for the child agent" }
      },
      required: ["agentSlug", "task"]
    }
  },

  async execute(input) {
    const agentSlug = typeof input.agentSlug === "string" ? input.agentSlug : "";
    const task = typeof input.task === "string" ? input.task : "";
    if (!agentSlug || !task) return "Error: agentSlug and task are required";

    // Phase 3 (runner.ts) wires up recursive runAgent() calls here.
    // This handler is updated in Phase 3 to actually invoke the child agent.
    console.warn(`[delegate-agent] delegation to "${agentSlug}" not yet active — implement Phase 3 runner first`);
    return `Delegation to agent "${agentSlug}" requires Phase 3 (runner) to be implemented.`;
  }
};
