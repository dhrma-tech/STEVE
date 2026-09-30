import { describe, expect, it } from "vitest";
import {
  AgentsPausedError,
  assertAgentsNotPaused,
  isAgentExecutionPaused,
  isOrchestratorV2Enabled
} from "@/lib/agents/flags";

const env = (values: Record<string, string | undefined>) => values as unknown as NodeJS.ProcessEnv;

describe("agent flags", () => {
  it("orchestrator v2 is off by default and on for truthy values", () => {
    expect(isOrchestratorV2Enabled(env({}))).toBe(false);
    expect(isOrchestratorV2Enabled(env({ ORCHESTRATOR_V2: "" }))).toBe(false);
    expect(isOrchestratorV2Enabled(env({ ORCHESTRATOR_V2: "0" }))).toBe(false);
    for (const on of ["1", "true", "TRUE", " yes ", "on"]) {
      expect(isOrchestratorV2Enabled(env({ ORCHESTRATOR_V2: on }))).toBe(true);
    }
  });

  it("kill switch throws AgentsPausedError only when on", () => {
    expect(isAgentExecutionPaused(env({}))).toBe(false);
    expect(() => assertAgentsNotPaused(env({}))).not.toThrow();
    expect(() => assertAgentsNotPaused(env({ AGENTS_PAUSED: "1" }))).toThrow(AgentsPausedError);
  });
});
