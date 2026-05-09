import { prisma } from "@/lib/db/client";

export const githubStateCookieName = "steve_github_state";

export type GitHubProfile = {
  githubId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export async function findOrCreateGitHubUser(profile: GitHubProfile) {
  const normalizedEmail = profile.email?.trim().toLowerCase() ?? null;
  const displayName = profile.displayName.trim() || "Founder";

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { githubId: profile.githubId },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : [])
      ]
    }
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          githubId: profile.githubId,
          email: normalizedEmail ?? existing.email,
          name: displayName,
          preferredName: existing.preferredName ?? displayName,
          avatarUrl: profile.avatarUrl,
          isSandbox: false
        }
      })
    : await prisma.user.create({
        data: {
          githubId: profile.githubId,
          email: normalizedEmail,
          name: displayName,
          preferredName: displayName,
          avatarUrl: profile.avatarUrl,
          onboardingStatus: "not_started",
          isSandbox: false
        }
      });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      preferredName: user.preferredName ?? displayName
    },
    create: {
      userId: user.id,
      preferredName: user.preferredName ?? displayName,
      timezone: "Asia/Calcutta",
      aiModel: "claude-sonnet-sandbox"
    }
  });

  return user;
}
