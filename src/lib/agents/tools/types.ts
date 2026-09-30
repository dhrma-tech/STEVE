export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

import type { RunScope } from "@/lib/agents/run-scope";

export interface ToolContext {
  orgId: string;
  agentId: string;
  sessionId: string;
  skillKeys: string[];
  /** Position in the run tree: depth, delegation chain, effective permission mode and shared budget. */
  scope: RunScope;
}

export type ToolExecuteFn = (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;

export interface AgentTool {
  definition: ToolDefinition;
  execute: ToolExecuteFn;
}
