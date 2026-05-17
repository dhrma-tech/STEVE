import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { githubStateCookieName } from "@/lib/auth/github-provider";
import { setSessionCookie } from "@/lib/auth/session";
import { findOrCreateSandboxUser } from "@/lib/auth/sandbox";
import { prisma } from "@/lib/db/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (clientId) {
    const redirectUri = new URL("/api/auth/github/callback", url.origin);
    const githubUrl = new URL("https://github.com/login/oauth/authorize");
    const state = randomBytes(18).toString("base64url");
    githubUrl.searchParams.set("client_id", clientId);
    githubUrl.searchParams.set("redirect_uri", redirectUri.toString());
    githubUrl.searchParams.set("scope", "read:user user:email");
    githubUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(githubUrl);
    response.cookies.set(githubStateCookieName, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10
    });
    return response;
  }

  const user = await findOrCreateSandboxUser({
    displayName: "Sandbox Founder",
    email: "sandbox-founder@example.com"
  });
  // Reset onboarding so dev users always land on /questions
  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingStatus: "not_started" }
  });
  await setSessionCookie(user.id);
  return NextResponse.redirect(new URL("/questions", url.origin));
}
