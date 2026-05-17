import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PreferencesSettingsForm
} from "@/components/settings/settings-sections";
import { SettingsShell } from "@/components/settings/settings-shell";
import { settingsNavItems } from "@/components/settings/settings-constants";
import { getPreferencesSettings } from "@/lib/settings/data";

export const metadata: Metadata = {
  title: "Settings"
};

type SettingsIndexPageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function SettingsIndexPage({ params }: SettingsIndexPageProps) {
  const { orgId } = await params;

  const navItem = settingsNavItems.find((item) => item.section === "preferences");
  if (!navItem) notFound();

  const data = await getPreferencesSettings(orgId);

  return (
    <SettingsShell orgId={orgId} activeSection="preferences" title="Preferences" description="Profile photo, theme, timezone, and account preferences.">
      <PreferencesSettingsForm orgId={orgId} initialData={data} />
    </SettingsShell>
  );
}
