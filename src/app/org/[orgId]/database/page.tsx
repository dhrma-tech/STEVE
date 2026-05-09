import { redirect } from "next/navigation";

type DatabaseShortcutPageProps = { params: Promise<{ orgId: string }> };

export default async function DatabaseShortcutPage({ params }: DatabaseShortcutPageProps) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/settings/advanced`);
}

