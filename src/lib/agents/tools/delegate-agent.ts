import { ARTIFACT_TYPES, HANDOFF_STATUSES } from "@/lib/agents/engine/handoff";
import type { AgentTool, ToolDefinition } from "./types";

/**
 * Orchestration tools. The run engine (engine/advance.ts) carries these out itself: a delegation starts the other
 * agent as its own durable run and this run waits for it in the database; a question to the founder pauses the run
 * until it is answered. The definitions here are what the model sees. `execute` exists only to satisfy the tool
 * interface and is never called by the engine.
 */
const handledByEngine = async () => "Error: this tool is handled by the run engine and cannot be called directly.";

const briefProperties = {
  agentSlug: { type: "string", description: "Slug of the teammate to hand the work to (see Your team)." },
  objective: { type: "string", description: "What the teammate must achieve, stated as an outcome." },
  context: { type: "string", description: "What they need to know: background, decisions made, relevant files or links." },
  constraints: { type: "string", description: "Limits to respect: scope, tone, tools not to use, deadlines." },
  acceptanceCriteria: {
    type: "array",
    items: { type: "string" },
    description: "Checks the result must pass to count as done."
  },
  deadline: { type: "string", description: "Optional due date or time, if it matters." },
  budgetCents: {
    type: "number",
    description: "Optional spending cap for this piece of work, in cents. Default: an equal share of your remaining budget."
  }
} as const;

const brief = (name: string, description: string): ToolDefinition => ({
  name,
  description,
  input_schema: { type: "object", properties: { ...briefProperties }, required: ["agentSlug", "objective"] }
});

export const delegateAgentTool: AgentTool = {
  definition: brief(
    "delegate_agent",
    "Hand a piece of work to a teammate. They run on their own with their own tools and send back a structured handoff " +
      "(status, summary, artifacts, findings, next steps). Several delegations in the same turn run in parallel. " +
      "You cannot delegate to yourself or to an agent already in the chain, depth is limited, and the teammate is never " +
      "less restricted than you are."
  ),
  execute: handledByEngine
};

export const delegateManyTool: AgentTool = {
  definition: {
    name: "delegate_many",
    description:
      "Hand several independent pieces of work to teammates at once. They all run in parallel and you get every handoff " +
      "back together. Use this to fan work out across departments.",
    input_schema: {
      type: "object",
      properties: {
        delegations: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "object", properties: { ...briefProperties }, required: ["agentSlug", "objective"] },
          description: "One brief per teammate."
        }
      },
      required: ["delegations"]
    }
  },
  execute: handledByEngine
};

export const askAgentTool: AgentTool = {
  definition: {
    name: "ask_agent",
    description:
      "Ask a teammate a quick question without handing them work. They answer from what they know using read-only tools " +
      "(no changes, no delegation). Use it to check a fact, a decision or an opinion in their area.",
    input_schema: {
      type: "object",
      properties: {
        agentSlug: { type: "string", description: "Slug of the teammate to ask." },
        question: { type: "string", description: "The question, with any context they need to answer it." }
      },
      required: ["agentSlug", "question"]
    }
  },
  execute: handledByEngine
};

export const askUserTool: AgentTool = {
  definition: {
    name: "ask_user",
    description:
      "Ask the founder a question and wait for the answer. Use it when you are missing information only they have or a " +
      "decision only they can make, instead of guessing. The run pauses until they answer.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question, short and specific." },
        context: { type: "string", description: "Why you are asking and what depends on the answer." },
        options: { type: "array", items: { type: "string" }, description: "Optional suggested answers." }
      },
      required: ["question"]
    }
  },
  execute: handledByEngine
};

export const finishRunTool: AgentTool = {
  definition: {
    name: "finish_run",
    description:
      "End your work and hand the result back. Call it once, as your last action, when the objective is met or you cannot " +
      "go further. Report honestly: use blocked, failed or needs_input when that is the truth.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...HANDOFF_STATUSES], description: "done | blocked | failed | needs_input" },
        summary: { type: "string", description: "What you did and the outcome, in at most 200 words." },
        artifacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: [...ARTIFACT_TYPES] },
              ref: { type: "string", description: "File name, URL, PR number, record id ..." },
              title: { type: "string" }
            },
            required: ["type", "ref"]
          },
          description: "What you produced."
        },
        findings: { type: "array", items: { type: "string" }, description: "Facts worth remembering." },
        nextSteps: { type: "array", items: { type: "string" }, description: "Proposed follow-ups (not executed)." },
        openQuestions: { type: "array", items: { type: "string" }, description: "Questions that block further progress." },
        confidence: { type: "number", description: "0 to 1: how sure you are the objective is met." }
      },
      required: ["status", "summary"]
    }
  },
  execute: handledByEngine
};

/** Tools the engine carries out itself instead of calling `execute`. */
export const ENGINE_TOOLS: ReadonlySet<string> = new Set(["delegate_agent", "delegate_many", "ask_agent", "ask_user", "finish_run"]);
