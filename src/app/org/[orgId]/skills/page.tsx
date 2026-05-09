import { redirect } from "next/navigation";

type SkillsShortcutPageProps = { params: Promise<{ orgId: string }> };

export default async function SkillsShortcutPage({ params }: SkillsShortcutPageProps) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/integrations`);
}

