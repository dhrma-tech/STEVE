import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getInboxItemsForUser } from "@/lib/notifications/inbox";

export type OrgShellData = Awaited<ReturnType<typeof getOrgShellData>>;

export async function getOrgShellData(orgId: string) {
  const { user, membership, organization } = await requireOrgMember(orgId);

  const [
    memberships,
    departmentCount,
    agentCount,
    activeTaskCount,
    fileCount,
    roadmapTotal,
    roadmapComplete,
    integrations,
    billing,
    inbox
  ] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.department.count({ where: { organizationId: orgId } }),
    prisma.agent.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.task.count({ where: { organizationId: orgId, archivedAt: null, status: { notIn: ["done", "completed", "archived"] } } }),
    prisma.file.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.roadmapItem.count({ where: { organizationId: orgId } }),
    prisma.roadmapItem.count({ where: { organizationId: orgId, status: "complete" } }),
    prisma.integration.findMany({ where: { organizationId: orgId }, orderBy: { provider: "asc" } }),
    prisma.billingAccount.findUnique({ where: { organizationId: orgId } }),
    getInboxItemsForUser({ orgId, userId: user.id })
  ]);

  return {
    user: {
      id: user.id,
      name: user.preferredName ?? "Founder",
      email: user.email,
      avatarUrl: user.avatarUrl,
      isSandbox: user.isSandbox
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      description: organization.description,
      designOnboardingStatus: organization.designOnboardingStatus,
      roadmapProgress: organization.roadmapProgress,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    },
    organizations: memberships
      .filter((item) => !item.organization.deletedAt)
      .map((item) => ({
        id: item.organization.id,
        name: item.organization.name,
        slug: item.organization.slug,
        status: item.organization.status,
        designOnboardingStatus: item.organization.designOnboardingStatus,
        role: item.role
      })),
    membershipRole: membership.role,
    counts: {
      departments: departmentCount,
      agents: agentCount,
      activeTasks: activeTaskCount,
      files: fileCount,
      roadmapTotal,
      roadmapComplete,
      integrations: integrations.length,
      sandboxIntegrations: integrations.filter((integration) => integration.mode === "sandbox").length
    },
    billing: billing
      ? {
          id: billing.id,
          plan: billing.plan,
          status: billing.status,
          includedUsageCents: billing.includedUsageCents,
          baseMonthlyCents: billing.baseMonthlyCents,
          trialEndsAt: billing.trialEndsAt?.toISOString() ?? null
        }
      : null,
    integrations: integrations.map((integration) => ({
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      mode: integration.mode,
      displayName: integration.displayName,
      lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null
    })),
    unreadInboxCount: inbox.unreadCount
  };
}
