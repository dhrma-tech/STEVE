import { prisma } from "@/lib/db/client";

export async function findOrCreateSandboxUser({
  displayName,
  email
}: {
  displayName: string;
  email: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = displayName.trim() || "Founder";

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      preferredName: trimmedName,
      name: trimmedName,
      isSandbox: true
    },
    create: {
      email: normalizedEmail,
      preferredName: trimmedName,
      name: trimmedName,
      onboardingStatus: "not_started",
      isSandbox: true
    }
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: { preferredName: trimmedName },
    create: {
      userId: user.id,
      preferredName: trimmedName,
      timezone: "Asia/Calcutta",
      aiModel: "claude-sonnet-sandbox"
    }
  });

  return user;
}

