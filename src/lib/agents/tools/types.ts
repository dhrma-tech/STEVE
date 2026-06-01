export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolContext {
  orgId: string;
  agentId: string;
  sessionId: string;
  skillKeys: string[];
}

export type ToolExecuteFn = (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;

export interface AgentTool {
  definition: ToolDefinition;
  execute: ToolExecuteFn;
}
