import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { appUrl } from "@/lib/agents/policy/one-tap";
import { completeOAuth, isOAuthProvider, OAUTH_NONCE_COOKIE, OAuthError } from "@/lib/integrations/oauth";
import { reportError } from "@/lib/observability/log";
import { clientIp, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = { params: Promise<{ provider: string }> };

/** The provider sends the user back here with a code; tokens are stored in the vault and the user returns to STEVE. */
export async function GET(request: Request, context: RouteContext) {
  const limited = await rateLimitResponse("auth", `ip:${clientIp(request)}`);
  if (limited) return limited;
  const { provider } = await context.params;
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const nonce = cookieStore.get(OAUTH_NONCE_COOKIE)?.value;
  const back = (path: string) => {
    const response = NextResponse.redirect(`${appUrl()}${path}`);
    response.cookies.set(OAUTH_NONCE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    return response;
  };

  const session = await getSession();
  if (!session.user) return back(`/login?next=${encodeURIComponent("/")}`);
  if (!isOAuthProvider(provider)) return back("/?oauth_error=unknown_provider");
  const providerError = url.searchParams.get("error");
  if (providerError) return back(`/?oauth_error=${encodeURIComponent(providerError)}`);

  try {
    const { orgId } = await completeOAuth({
      provider,
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      nonceCookie: nonce,
      userId: session.user.id,
      isOrgAdmin: async (orgId) =>
        !!(await prisma.membership.findFirst({ where: { organizationId: orgId, userId: session.user!.id, role: { in: ["owner", "admin"] } }, select: { id: true } }))
    });
    return back(`/org/${orgId}/integrations?connected=${provider}`);
  } catch (error) {
    if (!(error instanceof OAuthError)) await reportError(error, { route: "oauth/callback", provider });
    const message = error instanceof OAuthError ? error.message : "The connection could not be completed.";
    return back(`/?oauth_error=${encodeURIComponent(message)}`);
  }
}
