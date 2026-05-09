import { redirect } from "next/navigation";

type BillingShortcutPageProps = { params: Promise<{ orgId: string }> };

export default async function BillingShortcutPage({ params }: BillingShortcutPageProps) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/settings/billing`);
}

