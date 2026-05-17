import { getDepartmentVisual, initialDepartmentContext } from "@/data/departments";
import { roadmapDependencyPairs } from "@/data/roadmap";
import { prisma } from "@/lib/db/client";
import { departmentDefinitions, integrationProviders, roadmapDefinitions } from "@/lib/onboarding/definitions";

const json = (value: unknown) => JSON.stringify(value);

export async function activateOrganization({
  organizationId,
  userId
}: {
  organizationId: string;
  userId: string;
}) {
  // Remove seeded demo agents so users start with a clean slate
  await prisma.agent.deleteMany({
    where: { organizationId, isDefault: true }
  });

  const departmentBySlug = new Map<string, string>();

  for (const [sortOrder, definition] of departmentDefinitions.entries()) {
    const visual = getDepartmentVisual(definition.slug);
    const department = await prisma.department.upsert({
      where: { organizationId_slug: { organizationId, slug: definition.slug } },
      update: {
        name: definition.name,
        description: definition.description,
        availability: definition.availability,
        color: definition.color,
        icon: definition.icon,
        coverAsset: visual.coverAsset
      },
      create: {
        organizationId,
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        icon: definition.icon,
        color: definition.color,
        availability: definition.availability,
        coverAsset: visual.coverAsset,
        contextJson: json(initialDepartmentContext(definition.slug)),
        sortOrder
      }
    });

    departmentBySlug.set(definition.slug, department.id);

    await prisma.agent.upsert({
      where: { organizationId_slug: { organizationId, slug: `${definition.slug}-default` } },
      update: {
        departmentId: department.id,
        isDefault: true
      },
      create: {
        organizationId,
        departmentId: department.id,
        name: `${definition.name} Agent`,
        slug: `${definition.slug}-default`,
        description: `Default ${definition.name} department agent.`,
        isDefault: true,
        status: "idle",
        model: "claude-sonnet-sandbox",
        toolsJson: json({ sandbox: true }),
        permissionsJson: json({ dangerousActionsRequireApproval: true })
      }
    });
  }

  const generalFolder = await ensureGeneralFolder(organizationId);
  const businessPlanFile = await ensureBusinessPlanFile({ organizationId, userId, folderId: generalFolder.id });

  for (const [stageIndex, stage] of roadmapDefinitions.entries()) {
    const roadmapStage = await prisma.roadmapStage.upsert({
      where: { organizationId_key: { organizationId, key: stage.key } },
      update: { name: stage.name, sortOrder: stageIndex },
      create: {
        organizationId,
        key: stage.key,
        name: stage.name,
        sortOrder: stageIndex
      }
    });

    for (const [itemIndex, item] of stage.items.entries()) {
      const [key, title, status, workType] = item;
      await prisma.roadmapItem.upsert({
        where: { organizationId_key: { organizationId, key } },
        update: {
          stageId: roadmapStage.id,
          status
        },
        create: {
          organizationId,
          stageId: roadmapStage.id,
          departmentId: departmentForRoadmapKey(key, departmentBySlug),
          key,
          title,
          description: `${title} roadmap item.`,
          status,
          workType,
          whatBecomesTrue: `${title} becomes true for the company.`,
          howToMoveForward: "Launch an agent or provide the requested founder input.",
          sortOrder: itemIndex,
          completedAt: status === "complete" ? new Date() : null
        }
      });
    }
  }

  await ensureRoadmapDependencies(organizationId);

  for (const provider of integrationProviders) {
    await prisma.integration.upsert({
      where: {
        organizationId_provider_externalId: {
          organizationId,
          provider,
          externalId: `sandbox-${provider}`
        }
      },
      update: {
        status: "sandbox",
        mode: "sandbox",
        lastCheckedAt: new Date()
      },
      create: {
        organizationId,
        provider,
        status: "sandbox",
        mode: "sandbox",
        displayName: `${provider} sandbox`,
        externalId: `sandbox-${provider}`,
        configJson: json({ sandbox: true }),
        lastCheckedAt: new Date()
      }
    });
  }

  await prisma.billingAccount.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      plan: "trial",
      status: "trialing",
      includedUsageCents: 1500,
      baseMonthlyCents: 0,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  const [departments, agents, integrations] = await Promise.all([
    prisma.department.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.agent.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
    prisma.integration.findMany({ where: { organizationId }, orderBy: { provider: "asc" } })
  ]);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      status: "active",
      businessPlanFileId: businessPlanFile.id,
      designOnboardingStatus: "not_started",
      roadmapProgress: 9
    }
  });

  return {
    departments,
    agents,
    integrations,
    businessPlanFile,
    nextRoute: `/org/${organizationId}/onboarding?design_setup=1`
  };
}

export async function ensureGeneralFolder(organizationId: string) {
  const existing = await prisma.folder.findFirst({
    where: { organizationId, parentFolderId: null, name: "General", archivedAt: null }
  });

  if (existing) {
    return existing;
  }

  return prisma.folder.create({
    data: {
      organizationId,
      name: "General",
      sortOrder: 0
    }
  });
}

export async function ensureBusinessPlanFile({
  organizationId,
  userId,
  folderId,
  metadata
}: {
  organizationId: string;
  userId: string;
  folderId: string;
  metadata?: unknown;
}) {
  const existing = await prisma.file.findFirst({
    where: { organizationId, folderId, name: "Business Plan.md", archivedAt: null }
  });

  if (existing) {
    return prisma.file.update({
      where: { id: existing.id },
      data: {
        uploadedByUserId: userId,
        metadataJson: metadata ? json(metadata) : existing.metadataJson,
        updatedAt: new Date()
      }
    });
  }

  return prisma.file.create({
    data: {
      organizationId,
      folderId,
      uploadedByUserId: userId,
      name: "Business Plan.md",
      mimeType: "text/markdown",
      sizeBytes: 1024,
      storageKey: `orgs/${organizationId}/business-plan.md`,
      visibility: "organization",
      metadataJson: json(metadata ?? { source: "activation" })
    }
  });
}

function departmentForRoadmapKey(key: string, departmentBySlug: Map<string, string>) {
  if (key.includes("brand")) return departmentBySlug.get("design");
  if (key.includes("postiz") || key.includes("blog") || key.includes("seo") || key.includes("social") || key.includes("positioning")) return departmentBySlug.get("marketing");
  if (key.includes("prospect") || key.includes("outreach") || key.includes("deal") || key.includes("opportunit")) return departmentBySlug.get("sales");
  if (key.includes("bookkeeping") || key.includes("billing") || key.includes("bank")) return departmentBySlug.get("finance");
  if (key.includes("incorporate")) return departmentBySlug.get("legal");
  if (key.includes("support")) return departmentBySlug.get("support");
  return departmentBySlug.get("engineering");
}

async function ensureRoadmapDependencies(organizationId: string) {
  const keys = Array.from(new Set(roadmapDependencyPairs.flatMap(([itemKey, dependsOnKey]) => [itemKey, dependsOnKey])));
  const items = await prisma.roadmapItem.findMany({
    where: { organizationId, key: { in: keys } }
  });
  const byKey = new Map(items.map((item) => [item.key, item]));

  for (const [itemKey, dependsOnKey] of roadmapDependencyPairs) {
    const item = byKey.get(itemKey);
    const dependsOn = byKey.get(dependsOnKey);
    if (!item || !dependsOn) continue;

    await prisma.roadmapDependency.upsert({
      where: { itemId_dependsOnItemId: { itemId: item.id, dependsOnItemId: dependsOn.id } },
      update: {},
      create: {
        organizationId,
        itemId: item.id,
        dependsOnItemId: dependsOn.id
      }
    });
  }
}
