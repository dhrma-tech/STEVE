import type { Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { parseStoredHandoff } from "@/lib/agents/engine/handoff";
import { indexRunSummary } from "@/lib/knowledge/index";
import { departmentScope, keyFromText, remember } from "./store";

/** Runs whose findings are not facts about the company: review verdicts list problems, plans and reports restate. */
const NO_FINDINGS_KINDS = new Set(["review", "plan", "plan_report", "consult"]);
const MAX_FINDINGS = 5;

/**
 * What the team learns when a run finishes: its result is indexed for search, and the findings it reported in its
 * handoff are proposed as department memories for the founder to review. Findings never go straight into memory:
 * a run can be misled by what it read (a web page, an email), and memory is shown to every later run.
 */
export async function captureRunLearning(run: Run): Promise<void> {
  if (run.status !== "completed") return;
  try {
    await indexRunSummary(run);
    if (NO_FINDINGS_KINDS.has(run.kind)) return;
    const handoff = parseStoredHandoff(run.resultJson);
    if (!handoff?.findings.length) return;
    const agent = await prisma.agent.findUnique({ where: { id: run.agentId }, select: { slug: true, department: { select: { slug: true } } } });
    if (!agent) return;
    for (const finding of handoff.findings.slice(0, MAX_FINDINGS)) {
      await remember({
        orgId: run.organizationId,
        scope: departmentScope(agent.department.slug),
        key: keyFromText(finding),
        value: finding,
        confidence: handoff.confidence ?? null,
        source: `run:${run.id}`,
        sourceRunId: run.id,
        status: "proposed"
      });
    }
  } catch (error) {
    console.error(`[memory] could not capture what run ${run.id} learned:`, error);
  }
}
