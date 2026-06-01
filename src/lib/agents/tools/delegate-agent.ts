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

  async execute(input, ctx) {
    const agentSlug = typeof input.agentSlug === "string" ? input.agentSlug : "";
    const task = typeof input.task === "string" ? input.task : "";
    if (!agentSlug || !task) return "Error: agentSlug and task are required";

    // Lazy import to break the circular dependency: runner → registry → delegate-agent → runner
    const { runAgent } = await import("@/lib/agents/runner");
    const { prisma } = await import("@/lib/db/client");

    // Resolve agent slug → id
    const childAgent = await prisma.agent.findFirst({
      where: { organizationId: ctx.orgId, slug: agentSlug, archivedAt: null }
    });
    if (!childAgent) return `Error: no agent with slug "${agentSlug}" found in this org`;

    // Create a child task for the delegation
    const childTask = await prisma.task.create({
      data: {
        organizationId: ctx.orgId,
        departmentId: childAgent.departmentId,
        agentId: childAgent.id,
        title: task.split(/\r?\n/)[0]?.slice(0, 80) ?? task.slice(0, 80),
        description: task,
        type: "agent_task",
        status: "running",
        priority: 1,
        startedAt: new Date()
      }
    });

    // Create child session
    const childSession = await prisma.taskSession.create({
      data: {
        organizationId: ctx.orgId,
        taskId: childTask.id,
        agentId: childAgent.id,
        status: "running",
        startedAt: new Date(),
        scratchpad: `# ${childAgent.name} — Running\n\n**Delegated from session:** ${ctx.sessionId}`
      }
    });

    const events: string[] = [];
    const result = await runAgent({
      sessionId: childSession.id,
      agentId: childAgent.id,
      orgId: ctx.orgId,
      task,
      parentSessionId: ctx.sessionId,
      onEvent: (event) => {
        if (event.type === "tool_call") events.push(`[tool] ${event.tool}`);
        if (event.type === "tool_result") events.push(`[result] ${event.output.slice(0, 100)}`);
      }
    });

    return result.output || `Agent "${agentSlug}" completed with no output.`;
  }
};
