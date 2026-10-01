import { z } from "zod";

/**
 * The structured result a delegated run hands back to the agent that asked for the work (plan §7). A run ends by
 * calling `finish_run` with this shape; the engine validates it, fills in the real cost and stores it on the run.
 */
export const ARTIFACT_TYPES = ["file", "pr", "deployment", "post", "email", "link", "record", "task"] as const;
export const HANDOFF_STATUSES = ["done", "blocked", "failed", "needs_input"] as const;

const text = (max: number) => z.string().trim().max(max);

export const handoffInputSchema = z.object({
  status: z.enum(HANDOFF_STATUSES),
  summary: text(2000).min(1),
  artifacts: z
    .array(z.object({ type: z.enum(ARTIFACT_TYPES), ref: text(500).min(1), title: text(200).optional() }))
    .max(20)
    .default([]),
  findings: z.array(text(500)).max(20).default([]),
  nextSteps: z.array(text(500)).max(20).default([]),
  openQuestions: z.array(text(500)).max(10).default([]),
  confidence: z.number().min(0).max(1).optional()
});

export type HandoffInput = z.infer<typeof handoffInputSchema>;
export type Handoff = HandoffInput & { costCents: number };

/** Validate what the model passed to `finish_run`. Returns the handoff or a message to send back to the model. */
export function parseHandoffInput(input: unknown): { ok: true; handoff: HandoffInput } | { ok: false; error: string } {
  const parsed = handoffInputSchema.safeParse(input);
  if (parsed.success) return { ok: true, handoff: parsed.data };
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
  return { ok: false, error: `finish_run input is invalid (${issues}). Call finish_run again with a valid handoff.` };
}

/** A run that ended with plain text after being asked for a handoff: wrap its text so the parent still gets one. */
export function handoffFromText(output: string, status: Handoff["status"] = "done"): HandoffInput {
  const summary = output.trim() || "(no output)";
  return {
    status,
    summary: summary.length > 2000 ? `${summary.slice(0, 1990)} [...]` : summary,
    artifacts: [],
    findings: [],
    nextSteps: [],
    openQuestions: []
  };
}

export function parseStoredHandoff(json: string | null | undefined): Handoff | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as unknown;
    const parsed = handoffInputSchema.extend({ costCents: z.number() }).safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Markdown version of a handoff, for session scratchpads and task chat. */
export function renderHandoff(handoff: Handoff): string {
  const list = (title: string, items: string[]) => (items.length ? [`**${title}**`, ...items.map((item) => `- ${item}`), ""] : []);
  return [
    `**Status:** ${handoff.status.replace("_", " ")}`,
    "",
    handoff.summary,
    "",
    ...list("Artifacts", handoff.artifacts.map((a) => `${a.type}: ${a.title ? `${a.title} (${a.ref})` : a.ref}`)),
    ...list("Findings", handoff.findings),
    ...list("Next steps", handoff.nextSteps),
    ...list("Open questions", handoff.openQuestions)
  ]
    .join("\n")
    .trim();
}

/** What the parent agent's model sees as the result of a delegation. JSON, so it can act on each field. */
export function handoffForParent(agentSlug: string, handoff: Handoff): string {
  return JSON.stringify({ agent: agentSlug, ...handoff, costCents: Math.round(handoff.costCents * 100) / 100 });
}
