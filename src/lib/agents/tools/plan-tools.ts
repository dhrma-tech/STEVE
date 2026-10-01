import { MAX_PLAN_NODES } from "@/lib/agents/plans/schema";
import type { AgentTool } from "./types";

/**
 * The Chief of Staff's planning tool. Like the delegation tools, the run engine carries it out itself (it records
 * the plan on the run's Plan); `execute` only satisfies the tool interface.
 */
export const proposePlanTool: AgentTool = {
  definition: {
    name: "propose_plan",
    description:
      "Record the plan for the founder's goal as a dependency graph of steps. Each step has one owner (a teammate's " +
      "slug), acceptance criteria and the steps it must wait for; steps with no dependency between them run in " +
      "parallel. When revising a plan, send the whole plan again: finished steps keep their keys and stay as they are, " +
      "steps you leave out are skipped. Calling this ends your planning run.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "The approach in a few sentences, for the founder." },
        nodes: {
          type: "array",
          minItems: 1,
          maxItems: MAX_PLAN_NODES,
          description: "The steps.",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Short id, lowercase with dashes (\"build-page\"). Used in dependsOn." },
              title: { type: "string", description: "What the step delivers, in a few words." },
              description: { type: "string", description: "The brief for the owner: what to do, context, constraints." },
              agentSlug: { type: "string", description: "Owner: a teammate's slug from Your team." },
              dependsOn: { type: "array", items: { type: "string" }, description: "Keys of steps that must finish first." },
              acceptanceCriteria: { type: "array", items: { type: "string" }, description: "Checks the result must pass." },
              review: {
                type: "boolean",
                description: "Have the Reviewer check the result against the criteria before it counts as done. Use for code, copy, emails and anything published."
              },
              estimatedCostCents: { type: "number", description: "Rough model spend for this step, in cents." },
              estimatedMinutes: { type: "number", description: "Rough working time for this step, in minutes." },
              riskNotes: { type: "string", description: "What could go wrong or needs the founder's approval (spend, emails, deploys)." }
            },
            required: ["key", "title", "agentSlug"]
          }
        }
      },
      required: ["summary", "nodes"]
    }
  },
  execute: async () => "Error: this tool is handled by the run engine and cannot be called directly."
};
