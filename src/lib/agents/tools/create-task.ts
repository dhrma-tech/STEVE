import { prisma } from "@/lib/db/client";
import type { AgentTool } from "./types";

export const createTaskTool: AgentTool = {
  definition: {
    name: "create_task",
    description: "Create a new task in the organization. Returns the task ID.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        departmentId: { type: "string", description: "Department ID (optional, defaults to the agent's department)" },
        priority: { type: "number", description: "Priority: 0=low, 1=medium, 2=high" }
      },
      required: ["title"]
    }
  },
  async execute(input, ctx) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return "Error: title is required";
    const description = typeof input.description === "string" ? input.description.trim() : null;
    const priority = typeof input.priority === "number" ? input.priority : 1;

    let departmentId = typeof input.departmentId === "string" ? input.departmentId : null;
    if (!departmentId) {
      const agent = await prisma.agent.findUnique({ where: { id: ctx.agentId }, select: { departmentId: true } });
      departmentId = agent?.departmentId ?? null;
    }

    try {
      const task = await prisma.task.create({
        data: {
          organizationId: ctx.orgId,
          departmentId,
          agentId: ctx.agentId,
          title,
          description,
          type: "agent_task",
          status: "todo",
          priority
        }
      });
      return `Task created: "${task.title}" (ID: ${task.id})`;
    } catch (err) {
      return `Error creating task: ${String(err)}`;
    }
  }
};

export const updateTaskTool: AgentTool = {
  definition: {
    name: "update_task",
    description: "Update the status or description of an existing task.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID to update" },
        status: { type: "string", description: "New status: todo, running, ready_to_review, completed" },
        description: { type: "string", description: "Updated description" }
      },
      required: ["taskId"]
    }
  },
  async execute(input, ctx) {
    const taskId = typeof input.taskId === "string" ? input.taskId : "";
    if (!taskId) return "Error: taskId is required";
    const status = typeof input.status === "string" ? input.status : undefined;
    const description = typeof input.description === "string" ? input.description : undefined;

    try {
      const task = await prisma.task.findFirst({ where: { id: taskId, organizationId: ctx.orgId } });
      if (!task) return `Error: task "${taskId}" not found`;
      await prisma.task.update({
        where: { id: taskId },
        data: {
          ...(status ? { status } : {}),
          ...(description !== undefined ? { description } : {})
        }
      });
      return `Task "${taskId}" updated.`;
    } catch (err) {
      return `Error: ${String(err)}`;
    }
  }
};

export const assignTaskTool: AgentTool = {
  definition: {
    name: "assign_task",
    description: "Assign a task to another agent.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID to assign" },
        agentId: { type: "string", description: "Agent ID to assign the task to" }
      },
      required: ["taskId", "agentId"]
    }
  },
  async execute(input, ctx) {
    const taskId = typeof input.taskId === "string" ? input.taskId : "";
    const targetAgentId = typeof input.agentId === "string" ? input.agentId : "";
    if (!taskId || !targetAgentId) return "Error: taskId and agentId are required";

    try {
      const [task, agent] = await Promise.all([
        prisma.task.findFirst({ where: { id: taskId, organizationId: ctx.orgId } }),
        prisma.agent.findFirst({ where: { id: targetAgentId, organizationId: ctx.orgId } })
      ]);
      if (!task) return `Error: task "${taskId}" not found`;
      if (!agent) return `Error: agent "${targetAgentId}" not found`;
      await prisma.task.update({ where: { id: taskId }, data: { agentId: targetAgentId } });
      return `Task "${task.title}" assigned to agent "${agent.name}".`;
    } catch (err) {
      return `Error: ${String(err)}`;
    }
  }
};
