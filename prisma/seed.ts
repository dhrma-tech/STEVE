import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolve } from "node:path";
import { getDepartmentVisual, initialDepartmentContext } from "../src/data/departments";
import { roadmapDependencyPairs } from "../src/data/roadmap";

const sqliteFile = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./dev.db";
const sqliteUrl = resolve("prisma", sqliteFile);
const adapter = new PrismaBetterSqlite3({ url: sqliteUrl });
const prisma = new PrismaClient({ adapter });

const json = (value: unknown) => JSON.stringify(value);

const departments = [
  ["engineering", "Engineering", "Builds products, infrastructure, deployments, and technical systems.", "circuit", "#3b82f6", "active"],
  ["marketing", "Marketing", "Creates positioning, content engines, SEO, social publishing, and campaign signals.", "grid", "#f87171", "active"],
  ["sales", "Sales", "Finds prospects, builds outbound workflows, and qualifies opportunities.", "growth", "#22c55e", "active"],
  ["design", "Design", "Creates the brand kit, visual identity, product UI, and creative assets.", "palette", "#60a5fa", "active"],
  ["support", "Support", "Handles support workflows, inboxes, and customer response systems.", "lifebuoy", "#a78bfa", "coming_soon"],
  ["operations", "Operations", "Maintains systems, processes, handoffs, and operating cadence.", "workflow", "#818cf8", "coming_soon"],
  ["finance", "Finance", "Tracks bookkeeping, unit economics, billing readiness, and finance workflows.", "ledger", "#eab308", "coming_soon"],
  ["legal", "Legal", "Guides incorporation, terms, compliance, and legal operating tasks.", "scale", "#9ca3af", "coming_soon"]
] as const;

const roadmap = [
  {
    key: "idea",
    name: "IDEA STAGE",
    items: [["initial_idea", "Initial idea", "complete", "user"]]
  },
  {
    key: "initial",
    name: "INITIAL STAGE",
    items: [
      ["pick_company_name", "Pick company name", "complete", "user"],
      ["prepare_repository", "Prepare repository", "complete", "agent"],
      ["incorporate_llc", "Incorporate LLC", "available", "approval"]
    ]
  },
  {
    key: "identity",
    name: "IDENTITY STAGE",
    items: [
      ["brand_identity", "Brand identity", "available", "agent"],
      ["buy_domain", "Buy domain", "locked", "approval"],
      ["setup_social_presence", "Setup social presence", "locked", "agent"],
      ["define_positioning", "Define positioning", "locked", "user"],
      ["open_bank_account", "Open bank account", "locked", "approval"]
    ]
  },
  {
    key: "build",
    name: "BUILD STAGE",
    items: [
      ["build_app", "Build app", "locked", "agent"],
      ["add_auth", "Add auth", "locked", "agent"],
      ["transactional_email", "Set up transactional email", "locked", "agent"],
      ["marketing_website", "Build marketing website", "locked", "agent"],
      ["outbound_email", "Setup outbound email", "locked", "agent"],
      ["connect_postiz", "Connect Postiz", "locked", "approval"],
      ["gather_prospects", "Gather prospects", "locked", "agent"],
      ["setup_bookkeeping", "Setup bookkeeping", "locked", "approval"]
    ]
  },
  {
    key: "gtm",
    name: "GTM STAGE",
    items: [
      ["write_blog_posts", "Write blog posts", "locked", "agent"],
      ["grow_social_presence", "Grow social presence", "locked", "agent"],
      ["send_cold_outreach", "Send cold outreach", "locked", "approval"],
      ["run_paid_acquisition", "Run paid acquisition", "locked", "approval"]
    ]
  },
  {
    key: "launch",
    name: "LAUNCH STAGE",
    items: [
      ["deploy", "Deploy", "locked", "agent"],
      ["expand_content_engine", "Expand content engine", "locked", "agent"],
      ["launch_website", "Launch website", "locked", "agent"],
      ["qualify_opportunities", "Qualify opportunities", "locked", "agent"]
    ]
  },
  {
    key: "scale",
    name: "SCALE STAGE",
    items: [
      ["add_monitoring", "Add monitoring", "locked", "agent"],
      ["optimize_seo", "Optimize SEO", "locked", "agent"],
      ["start_community", "Start community", "locked", "user"],
      ["close_deals", "Close deals", "locked", "user"],
      ["onboard_accounts", "Onboard accounts", "locked", "agent"],
      ["add_billing", "Add billing", "locked", "approval"],
      ["setup_support_agent", "Setup support agent", "locked", "agent"]
    ]
  },
  {
    key: "mature",
    name: "MATURE STAGE",
    items: []
  }
] as const;

const integrationProviders = [
  "github",
  "vercel",
  "supabase",
  "stripe",
  "postiz",
  "apify",
  "domain",
  "email",
  "posthog",
  "sentry",
  "datadog",
  "support"
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "sandbox-founder@example.com" },
    update: {},
    create: {
      email: "sandbox-founder@example.com",
      name: "Sandbox Founder",
      preferredName: "Founder",
      onboardingStatus: "complete",
      technicalExperience: "writes_code",
      primaryRole: "Founder / Executive",
      companyStage: "idea",
      lastOrgSlug: "dstack-b29488",
      isSandbox: true
    }
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "dstack-b29488" },
    update: {},
    create: {
      name: "DSTACK",
      slug: "dstack-b29488",
      description: "Sandbox company seeded from the Cofounder.co product notes.",
      stage: "idea",
      status: "active",
      designOnboardingStatus: "not_started",
      roadmapProgress: 11,
      currentPlan: "trial",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
    update: { role: "owner" },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      acceptedAt: new Date()
    }
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      preferredName: "Founder",
      timezone: "Asia/Calcutta",
      aiModel: "claude-sonnet-sandbox",
      reviewBotMode: "blockers_only"
    }
  });

  await prisma.notificationPreference.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    update: {},
    create: {
      userId: user.id,
      organizationId: organization.id,
      desktopAlerts: false
    }
  });

  const departmentBySlug = new Map<string, string>();

  for (const [index, dept] of departments.entries()) {
    const [slug, name, description, icon, color, availability] = dept;
    const visual = getDepartmentVisual(slug);
    const department = await prisma.department.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug } },
      update: { availability, coverAsset: visual.coverAsset },
      create: {
        organizationId: organization.id,
        slug,
        name,
        description,
        icon,
        color,
        availability,
        coverAsset: visual.coverAsset,
        contextJson: json(initialDepartmentContext(slug)),
        sortOrder: index
      }
    });

    departmentBySlug.set(slug, department.id);

    await prisma.agent.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: `${slug}-default` } },
      update: {},
      create: {
        organizationId: organization.id,
        departmentId: department.id,
        name: `${name} Agent`,
        slug: `${slug}-default`,
        description: `Default ${name} department agent.`,
        isDefault: true,
        status: "idle",
        model: "claude-sonnet-sandbox",
        toolsJson: json({ sandbox: true }),
        permissionsJson: json({ dangerousActionsRequireApproval: true })
      }
    });
  }

  const existingGeneralFolder = await prisma.folder.findFirst({
    where: { organizationId: organization.id, parentFolderId: null, name: "General" }
  });

  const generalFolder = existingGeneralFolder ?? await prisma.folder.create({
    data: {
      organizationId: organization.id,
      name: "General",
      sortOrder: 0
    }
  });

  const businessPlan = await prisma.file.upsert({
    where: { id: "seed-business-plan" },
    update: {},
    create: {
      id: "seed-business-plan",
      organizationId: organization.id,
      folderId: generalFolder.id,
      uploadedByUserId: user.id,
      name: "Business Plan.md",
      mimeType: "text/markdown",
      sizeBytes: 512,
      storageKey: "seed/business-plan.md",
      visibility: "organization",
      metadataJson: json({
        productOrService: "Sandbox product description",
        icp: "Early-stage founders"
      })
    }
  });

  await prisma.organization.update({
    where: { id: organization.id },
    data: { businessPlanFileId: businessPlan.id }
  });

  for (const [stageIndex, stage] of roadmap.entries()) {
    const createdStage = await prisma.roadmapStage.upsert({
      where: { organizationId_key: { organizationId: organization.id, key: stage.key } },
      update: {},
      create: {
        organizationId: organization.id,
        key: stage.key,
        name: stage.name,
        sortOrder: stageIndex
      }
    });

    for (const [itemIndex, item] of stage.items.entries()) {
      const [key, title, status, workType] = item;
      await prisma.roadmapItem.upsert({
        where: { organizationId_key: { organizationId: organization.id, key } },
        update: { status },
        create: {
          organizationId: organization.id,
          stageId: createdStage.id,
          departmentId:
            key.includes("brand") ? departmentBySlug.get("design") :
            key.includes("postiz") || key.includes("blog") || key.includes("seo") ? departmentBySlug.get("marketing") :
            key.includes("prospect") || key.includes("outreach") || key.includes("deal") ? departmentBySlug.get("sales") :
            key.includes("bookkeeping") || key.includes("billing") ? departmentBySlug.get("finance") :
            key.includes("incorporate") ? departmentBySlug.get("legal") :
            key.includes("support") ? departmentBySlug.get("support") :
            departmentBySlug.get("engineering"),
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

  const dependencyKeys = Array.from(new Set(roadmapDependencyPairs.flatMap(([itemKey, dependsOnKey]) => [itemKey, dependsOnKey])));
  const dependencyItems = await prisma.roadmapItem.findMany({
    where: { organizationId: organization.id, key: { in: dependencyKeys } }
  });
  const itemByKey = new Map(dependencyItems.map((item) => [item.key, item]));

  for (const [itemKey, dependsOnKey] of roadmapDependencyPairs) {
    const item = itemByKey.get(itemKey);
    const dependsOn = itemByKey.get(dependsOnKey);
    if (item && dependsOn) {
      await prisma.roadmapDependency.upsert({
        where: { itemId_dependsOnItemId: { itemId: item.id, dependsOnItemId: dependsOn.id } },
        update: {},
        create: {
          organizationId: organization.id,
          itemId: item.id,
          dependsOnItemId: dependsOn.id
        }
      });
    }
  }

  for (const provider of integrationProviders) {
    await prisma.integration.upsert({
      where: {
        organizationId_provider_externalId: {
          organizationId: organization.id,
          provider,
          externalId: `sandbox-${provider}`
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
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
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      plan: "trial",
      status: "trialing",
      includedUsageCents: 1500,
      baseMonthlyCents: 0,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  console.log("Seed complete:", {
    user: user.email,
    organization: organization.slug,
    departments: departments.length,
    integrations: integrationProviders.length
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
