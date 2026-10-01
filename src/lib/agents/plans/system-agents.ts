import { prisma } from "@/lib/db/client";
import { AppError } from "@/lib/utils/error";

/**
 * Agents that run the team rather than sit on it: the Chief of Staff plans goals, assigns the steps and reports;
 * the Reviewer checks finished steps against their acceptance criteria. They are created per organization on first
 * use, are left out of the team directory, and cannot be delegated to.
 */
export const ORCHESTRATOR_SLUG = "chief-of-staff";
export const REVIEWER_SLUG = "reviewer";
export const SYSTEM_AGENT_SLUGS: ReadonlySet<string> = new Set([ORCHESTRATOR_SLUG, REVIEWER_SLUG]);

const DEFINITIONS = {
  [ORCHESTRATOR_SLUG]: {
    name: "Chief of Staff",
    description: "Turns founder goals into plans, assigns the work across departments and reports back.",
    role: "Plans goals, assigns steps to departments, monitors progress, replans and reports to the founder.",
    capabilities: ["planning", "coordination", "reporting"],
    modelTier: "planner"
  },
  [REVIEWER_SLUG]: {
    name: "Reviewer",
    description: "Checks finished work against its acceptance criteria before it counts as done.",
    role: "Reviews deliverables against acceptance criteria.",
    capabilities: ["quality review"],
    modelTier: "worker"
  }
} as const;

type SystemSlug = keyof typeof DEFINITIONS;

/** The department system agents sit in: Operations when the org has it, otherwise its first department. */
async function homeDepartment(orgId: string) {
  return (
    (await prisma.department.findFirst({ where: { organizationId: orgId, slug: "operations" } })) ??
    (await prisma.department.findFirst({ where: { organizationId: orgId }, orderBy: { sortOrder: "asc" } }))
  );
}

async function ensureSystemAgent(orgId: string, slug: SystemSlug) {
  const existing = await prisma.agent.findUnique({ where: { organizationId_slug: { organizationId: orgId, slug } } });
  if (existing) {
    if (existing.archivedAt) return prisma.agent.update({ where: { id: existing.id }, data: { archivedAt: null } });
    return existing;
  }
  const department = await homeDepartment(orgId);
  if (!department) throw new AppError("Activate the company's departments before planning goals.", 409, "CONFLICT");
  const definition = DEFINITIONS[slug];
  // Two requests at once may both get here; the unique slug lets only one create it.
  return prisma.agent.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug } },
    update: {},
    create: {
      organizationId: orgId,
      departmentId: department.id,
      name: definition.name,
      slug,
      description: definition.description,
      role: definition.role,
      capabilitiesJson: JSON.stringify(definition.capabilities),
      modelTier: definition.modelTier,
      // Not the department's default agent: tasks for the department must not land on it.
      isDefault: false,
      status: "idle",
      model: "claude-sonnet-sandbox",
      toolsJson: JSON.stringify({ skillKeys: [] }),
      permissionsJson: JSON.stringify({ mode: "review_required" })
    }
  });
}

export const ensureOrchestrator = (orgId: string) => ensureSystemAgent(orgId, ORCHESTRATOR_SLUG);
export const ensureReviewer = (orgId: string) => ensureSystemAgent(orgId, REVIEWER_SLUG);

export function isSystemAgentSlug(slug: string): boolean {
  return SYSTEM_AGENT_SLUGS.has(slug);
}
