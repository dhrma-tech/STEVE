import { type NextRequest, NextResponse } from "next/server";

/**
 * Light-mode route prefixes per Slice 3 dual-mode system.
 * All (marketing) routes + /login + /onboarding receive x-theme: light.
 * Everything else (app shell, api, etc.) defaults to dark.
 */
const LIGHT_PREFIXES = [
  "/login",
  "/onboarding",
  "/pricing",
  "/resources",
  "/how-to",
  "/privacy-policy",
  "/terms",
  "/terms-of-service",
  "/docs",
  "/referrals",   // marketing-facing referral landing (unauthenticated)
];

function isLightRoute(pathname: string): boolean {
  // Root marketing page
  if (pathname === "/") return true;
  return LIGHT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const theme = isLightRoute(pathname) ? "light" : "dark";
  const response = NextResponse.next();
  response.headers.set("x-theme", theme);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - Any path containing a file extension (e.g. .png, .svg, .woff2)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};
