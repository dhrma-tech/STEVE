import type { AgentTool } from "./types";
import { webSearchTool } from "./web-search";
import { readFileTool, writeFileTool, listFilesTool, deleteFileTool } from "./file-ops";
import { githubListReposTool, githubReadFileTool, githubCreateBranchTool, githubPushFileTool, githubCreatePrTool } from "./github";
import { vercelListDeploymentsTool, vercelGetDeploymentTool, vercelTriggerDeployTool } from "./vercel";
import { postizCreatePostTool, postizSchedulePostTool, postizListPostsTool } from "./postiz";
import { delegateAgentTool } from "./delegate-agent";
import { memoryStoreTool, memoryRetrieveTool, memoryListTool } from "./memory";
import { createTaskTool, updateTaskTool, assignTaskTool } from "./create-task";

/**
 * Builds the toolset for an agent based on its skill keys.
 * Always-on tools are included unconditionally; integration tools
 * are gated behind the corresponding skill key.
 */
export function buildToolset(skillKeys: string[]): AgentTool[] {
  const tools: AgentTool[] = [
    // Always available
    webSearchTool,
    readFileTool,
    writeFileTool,
    listFilesTool,
    deleteFileTool,
    delegateAgentTool,
    memoryStoreTool,
    memoryRetrieveTool,
    memoryListTool,
    createTaskTool,
    updateTaskTool,
    assignTaskTool
  ];

  if (skillKeys.includes("github-repository")) {
    tools.push(
      githubListReposTool,
      githubReadFileTool,
      githubCreateBranchTool,
      githubPushFileTool,
      githubCreatePrTool
    );
  }

  if (skillKeys.includes("vercel-preview")) {
    tools.push(vercelListDeploymentsTool, vercelGetDeploymentTool, vercelTriggerDeployTool);
  }

  if (skillKeys.includes("postiz-social")) {
    tools.push(postizCreatePostTool, postizSchedulePostTool, postizListPostsTool);
  }

  return tools;
}

export type { AgentTool, ToolContext, ToolDefinition } from "./types";
