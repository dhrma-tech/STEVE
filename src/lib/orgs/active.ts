import { prisma } from "@/lib/db/client";

/**
 * Resolve the workspace URL for a returning user.
 *
 * The user's `lastOrgSlug` column is the persisted hint of "most recently
 * visited org." If it still resolves to an org they belong to, use it; otherwise
 * fall back to their oldest membership; otherwise null.
 */
export async function resolveActiveOrg(userId: string): Promise<{ id: string; slug: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastOrgSlug: true }
  });

  if (user?.lastOrgSlug) {
    const stored = await prisma.organization.findFirst({
      where: {
        slug: user.lastOrgSlug,
        deletedAt: null,
        memberships: { some: { userId } }
      },
      select: { id: true, slug: true }
    });
    if (stored) return stored;
  }

  const fallback = await prisma.membership.findFirst({
    where: { userId, organization: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { id: true, slug: true } } }
  });

  if (!fallback) return null;
  return { id: fallback.organization.id, slug: fallback.organization.slug };
}
