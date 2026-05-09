import { redirect } from "next/navigation";

type DomainsShortcutPageProps = { params: Promise<{ orgId: string }> };

export default async function DomainsShortcutPage({ params }: DomainsShortcutPageProps) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/settings/inbox`);
}

