import { redirect } from "next/navigation";

type SettingsIndexPageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function SettingsIndexPage({ params }: SettingsIndexPageProps) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/settings/preferences`);
}

