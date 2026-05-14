import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { getSession } from "@/lib/auth/session";
import { resolveActiveOrg } from "@/lib/orgs/active";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const activeOrg = session.user ? await resolveActiveOrg(session.user.id) : null;
  const workspaceHref = activeOrg
    ? `/org/${activeOrg.id}/canvas`
    : session.user
      ? "/onboarding"
      : "/login";

  return (
    <>
      <MarketingNav signedIn={Boolean(session.user)} workspaceHref={workspaceHref} />
      {children}
      <MarketingFooter />
    </>
  );
}

