import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { AuthError, ForbiddenError } from "@/lib/auth/session";
import { getOrgShellData } from "@/lib/orgs/shell";

type OrgLayoutProps = {
  children: ReactNode;
  params: Promise<unknown>;
};

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgId } = (await params) as { orgId: string };
  let shell;

  try {
    shell = await getOrgShellData(orgId);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    if (error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  return <AppShell shell={shell}>{children}</AppShell>;
}
