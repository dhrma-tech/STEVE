import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findOrCreateGitHubUser, githubStateCookieName } from "@/lib/auth/github-provider";
import { destinationForSession, getSession, setSessionCookie } from "@/lib/auth/session";

type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type GitHubEmailResponse = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(githubStateCookieName)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail(url, "github_state");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return fail(url, "github_config");
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });
    const token = (await tokenResponse.json()) as GitHubTokenResponse;

    if (!tokenResponse.ok || !token.access_token || token.error) {
      return fail(url, "github_token");
    }

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token.access_token}`
      }
    });
    const profile = (await profileResponse.json()) as GitHubUserResponse;

    if (!profileResponse.ok || !profile.id) {
      return fail(url, "github_profile");
    }

    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token.access_token}`
      }
    });
    const emails = emailsResponse.ok ? ((await emailsResponse.json()) as GitHubEmailResponse[]) : [];
    const email =
      profile.email ??
      emails.find((item) => item.primary && item.verified)?.email ??
      emails.find((item) => item.verified)?.email ??
      null;

    const user = await findOrCreateGitHubUser({
      githubId: String(profile.id),
      email,
      displayName: profile.name ?? profile.login,
      avatarUrl: profile.avatar_url
    });

    await setSessionCookie(user.id);
    const session = await getSession();
    const response = NextResponse.redirect(new URL(destinationForSession(session), url.origin));
    response.cookies.set(githubStateCookieName, "", { path: "/", maxAge: 0 });
    return response;
  } catch {
    return fail(url, "github_callback");
  }
}

function fail(url: URL, reason: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));
  response.cookies.set(githubStateCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
