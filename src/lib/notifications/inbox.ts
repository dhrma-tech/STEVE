import { prisma } from "@/lib/db/client";

export type InboxItem = {
  id: string;
  kind: "onboarding" | "roadmap" | "task" | "file" | "integration" | "billing";
  title: string;
  description: string;
  href: string;
  status: string;
  createdAt: string;
  read: boolean;
};

export type InboxState = {
  items: InboxItem[];
  unreadCount: number;
  empty: boolean;
};

export async function getInboxItemsForUser({
  orgId,
  userId
}: {
  orgId: string;
  userId: string;
}): Promise<InboxState> {
  const [organization, roadmapItems, tasks, files, integrations, billing, readLogs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.roadmapItem.findMany({
      where: { organizationId: orgId, status: { in: ["available", "complete"] } },
      include: { stage: true, department: true },
      orderBy: [{ updatedAt: "desc" }, { sortOrder: "asc" }],
      take: 5
    }),
    prisma.task.findMany({
      where: {
        organizationId: orgId,
        archivedAt: null,
        status: { in: ["needs_approval", "blocked", "running", "todo", "available"] }
      },
      include: { department: true, agent: true },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    prisma.file.findMany({
      where: { organizationId: orgId, archivedAt: null, name: { contains: "Business Plan" } },
      orderBy: { updatedAt: "desc" },
      take: 2
    }),
    prisma.integration.findMany({
      where: { organizationId: orgId },
      orderBy: { provider: "asc" },
      take: 12
    }),
    prisma.billingAccount.findUnique({ where: { organizationId: orgId } }),
    prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        actorUserId: userId,
        action: "inbox.read",
        targetType: "notification"
      },
      select: { targetId: true }
    })
  ]);

  const readIds = new Set(readLogs.map((log) => log.targetId).filter(Boolean));
  const items: Array<Omit<InboxItem, "read">> = [];

  items.push({
    id: `org:${organization.id}:status`,
    kind: "onboarding",
    title: organization.status === "active" ? "Workspace activated" : "Company onboarding in progress",
    description:
      organization.status === "active"
        ? `${organization.name} has departments, roadmap, files, and managed integrations ready.`
        : "Finish company onboarding to activate departments and the roadmap.",
    href: organization.status === "active" ? `/org/${orgId}/canvas` : `/org/${orgId}/onboarding`,
    status: organization.status,
    createdAt: organization.updatedAt.toISOString()
  });

  if (organization.designOnboardingStatus !== "complete") {
    items.push({
      id: `org:${organization.id}:design`,
      kind: "onboarding",
      title: "Design setup needs review",
      description: "Finish or skip design onboarding so future brand and marketing work has context.",
      href: `/org/${orgId}/onboarding?design_setup=1`,
      status: organization.designOnboardingStatus,
      createdAt: organization.updatedAt.toISOString()
    });
  }

  for (const file of files) {
    items.push({
      id: `file:${file.id}`,
      kind: "file",
      title: `${file.name} saved`,
      description: "The business plan is available in the General library folder.",
      href: `/org/${orgId}/canvas?file=${file.id}`,
      status: file.visibility,
      createdAt: file.updatedAt.toISOString()
    });
  }

  for (const task of tasks) {
    items.push({
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      description: [task.status, task.department?.name, task.agent?.name].filter(Boolean).join(" - ") || "Task needs attention.",
      href: `/org/${orgId}/canvas?task=${task.id}`,
      status: task.status,
      createdAt: task.updatedAt.toISOString()
    });
  }

  for (const item of roadmapItems) {
    items.push({
      id: `roadmap:${item.id}`,
      kind: "roadmap",
      title: item.status === "complete" ? `${item.title} complete` : `${item.title} ready`,
      description: [item.stage.name, item.department?.name, item.workType].filter(Boolean).join(" - "),
      href: `/org/${orgId}/canvas?open_tech_tree=1&roadmap=${item.id}`,
      status: item.status,
      createdAt: item.updatedAt.toISOString()
    });
  }

  const sandboxCount = integrations.filter((integration) => integration.mode === "sandbox").length;
  if (sandboxCount > 0) {
    items.push({
      id: `integrations:${orgId}:sandbox`,
      kind: "integration",
      title: `${sandboxCount} managed integrations in sandbox`,
      description: "Provider records are active locally and ready for live credentials later.",
      href: `/org/${orgId}/settings/integrations`,
      status: "sandbox",
      createdAt: integrations[0]?.updatedAt.toISOString() ?? organization.updatedAt.toISOString()
    });
  }

  if (billing) {
    items.push({
      id: `billing:${billing.id}`,
      kind: "billing",
      title: `${billing.plan} plan ${billing.status}`,
      description: billing.trialEndsAt ? `Trial ends ${billing.trialEndsAt.toLocaleDateString("en-US")}.` : "Billing account is ready.",
      href: `/org/${orgId}/settings/billing`,
      status: billing.status,
      createdAt: billing.updatedAt.toISOString()
    });
  }

  const withReadState = items
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => ({ ...item, read: readIds.has(item.id) }));
  const unreadCount = withReadState.filter((item) => !item.read).length;

  return {
    items: withReadState,
    unreadCount,
    empty: unreadCount === 0
  };
}

export async function markInboxItemRead({
  orgId,
  userId,
  notificationId
}: {
  orgId: string;
  userId: string;
  notificationId: string;
}) {
  const inbox = await getInboxItemsForUser({ orgId, userId });
  const item = inbox.items.find((candidate) => candidate.id === notificationId);

  if (!item) {
    return null;
  }

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorUserId: userId,
      action: "inbox.read",
      targetType: "notification",
      targetId: notificationId,
      metadataJson: JSON.stringify({ source: "app-shell" })
    }
  });

  return { ...item, read: true };
}

export async function markAllInboxItemsRead({ orgId, userId }: { orgId: string; userId: string }) {
  const inbox = await getInboxItemsForUser({ orgId, userId });
  const unread = inbox.items.filter((item) => !item.read);

  if (unread.length) {
    await prisma.auditLog.createMany({
      data: unread.map((item) => ({
        organizationId: orgId,
        actorUserId: userId,
        action: "inbox.read",
        targetType: "notification",
        targetId: item.id,
        metadataJson: JSON.stringify({ source: "app-shell-read-all" })
      }))
    });
  }

  return {
    items: inbox.items.map((item) => ({ ...item, read: true })),
    unreadCount: 0,
    empty: true
  };
}
