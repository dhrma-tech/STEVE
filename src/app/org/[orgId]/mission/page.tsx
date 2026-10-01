import type { Metadata } from "next";
import { MissionControl } from "@/components/mission/mission-control";
import { requireOrgMember } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Mission Control",
  description: "Watch the agents work, decide what needs you, and read the daily briefing."
};

type MissionPageProps = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MissionPage({ params, searchParams }: MissionPageProps) {
  const { orgId } = await params;
  const query = await searchParams;
  const { membership } = await requireOrgMember(orgId);
  const tab = typeof query.tab === "string" ? query.tab : null;
  return <MissionControl orgId={orgId} initialTab={tab} role={membership.role} />;
}
