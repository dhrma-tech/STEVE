import type { AgentTool } from "@/lib/agents/tools/types";

/**
 * Stand-ins for tools that reach outside services, used by the eval suite. Kept free of engine imports: the tool
 * registry mock loads this module while the engine itself is still loading.
 */

/** Tools the run engine carries out itself; they stay real. */
const ENGINE_TOOL_NAMES = new Set(["delegate_agent", "delegate_many", "ask_agent", "ask_user", "finish_run", "propose_plan"]);

/** Calls the stand-in tools received in the current scenario. */
export const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
const outputs: Record<string, string> = {};

export function resetStandIns(toolOutputs: Record<string, string> = {}) {
  toolCalls.length = 0;
  for (const key of Object.keys(outputs)) delete outputs[key];
  Object.assign(outputs, toolOutputs);
}

/** The real toolset with every outside effect replaced: engine tools stay real, everything else is a stand-in. */
export function standInToolset(real: AgentTool[]): AgentTool[] {
  return real.map((tool) =>
    ENGINE_TOOL_NAMES.has(tool.definition.name)
      ? tool
      : {
          definition: tool.definition,
          execute: async (input: Record<string, unknown>) => {
            toolCalls.push({ name: tool.definition.name, input });
            return outputs[tool.definition.name] ?? `${tool.definition.name}: ok`;
          }
        }
  );
}
