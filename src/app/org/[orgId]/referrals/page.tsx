import { redirect } from "next/navigation";

type ReferralsShortcutPageProps = { params: Promise<{ orgId: string }> };

export default async function ReferralsShortcutPage({ params }: ReferralsShortcutPageProps) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/settings/organization`);
}
