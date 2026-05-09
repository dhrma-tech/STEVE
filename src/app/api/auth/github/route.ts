import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { githubStateCookieName } from "@/lib/auth/github-provider";
import { destinationForSession, getSession, setSessionCookie } from "@/lib/auth/session";
import { findOrCreateSandboxUser } from "@/lib/auth/sandbox";

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
  await setSessionCookie(user.id);
  const session = await getSession();
  return NextResponse.redirect(new URL(destinationForSession(session), url.origin));
}
