import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";

export const sessionCookieName = "steve_session";
const maxAgeSeconds = 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: string;
  issuedAt: number;
};

export type SessionUser = {
  id: string;
  email: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  onboardingStatus: string;
  isSandbox: boolean;
};

export type SessionOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
  designOnboardingStatus: string;
};

export type SessionShape = {
  user: SessionUser | null;
  organizations: SessionOrganization[];
  activeOrgId: string | null;
};

export class AuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getSession(): Promise<SessionShape> {
  const userId = await readSessionUserId();

  if (!userId) {
    return { user: null, organizations: [], activeOrgId: null };
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!user) {
    return { user: null, organizations: [], activeOrgId: null };
  }

  const organizations = user.memberships
    .filter((membership) => !membership.organization.deletedAt)
    .map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
      status: membership.organization.status,
      designOnboardingStatus: membership.organization.designOnboardingStatus
    }));

  const activeOrganization = organizations.find((organization) => organization.slug === user.lastOrgSlug) ?? organizations[0] ?? null;

  return {
    user: {
      id: user.id,
      email: user.email,
      preferredName: user.preferredName ?? user.name,
      avatarUrl: user.avatarUrl,
      onboardingStatus: user.onboardingStatus,
      isSandbox: user.isSandbox
    },
    organizations,
    activeOrgId: activeOrganization?.id ?? null
  };
}

export async function requireUser() {
  const session = await getSession();

  if (!session.user) {
    throw new AuthError();
  }

  return session.user;
}

export async function requireOrgMember(orgId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    include: { organization: true }
  });

  if (!membership || membership.organization.deletedAt) {
    throw new ForbiddenError("Organization access required");
  }

  return { user, membership, organization: membership.organization };
}

export async function requireOrgAdmin(orgId: string) {
  const context = await requireOrgMember(orgId);

  if (!["owner", "admin"].includes(context.membership.role)) {
    throw new ForbiddenError("Organization admin access required");
  }

  return context;
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, signPayload({ userId, issuedAt: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

async function readSessionUserId() {
  const cookieStore = await cookies();
  const value = cookieStore.get(sessionCookieName)?.value;
  const payload = value ? verifyPayload(value) : null;
  return payload?.userId ?? null;
}

function signPayload(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signatureFor(encoded);
  return `${encoded}.${signature}`;
}

function verifyPayload(value: string): SessionPayload | null {
  const [encoded, signature] = value.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = signatureFor(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || typeof payload.issuedAt !== "number") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function signatureFor(encodedPayload: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "cofounder-local-dev-session-secret")
    .update(encodedPayload)
    .digest("base64url");
}

export function destinationForSession(session: SessionShape) {
  if (!session.user) {
    return "/login";
  }

  if (session.user.onboardingStatus !== "complete") {
    return "/onboarding";
  }

  const activeOrg = session.organizations.find((organization) => organization.id === session.activeOrgId) ?? session.organizations[0];

  if (!activeOrg) {
    return "/onboarding";
  }

  if (activeOrg.status !== "active" || activeOrg.designOnboardingStatus !== "complete") {
    return `/org/${activeOrg.id}/onboarding`;
  }

  return `/org/${activeOrg.id}/canvas`;
}

