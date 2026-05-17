import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import {
  AdvancedSettingsPanel,
  AiSettingsForm,
  EnvFilesSettingsPanel,
  InboxSettingsPanel,
  NotificationSettingsForm,
  OrganizationSettingsForm,
  PaymentsSettingsPanel,
  PreferencesSettingsForm,
  SupportSettingsPanel
} from "@/components/settings/settings-sections";
import { SettingsShell } from "@/components/settings/settings-shell";
import { settingsNavItems, type SettingsSection } from "@/components/settings/settings-constants";
import { getBillingData } from "@/lib/billing/data";
import { getIntegrationDetail } from "@/lib/integrations/data";
import {
  getAdvancedSettings,
  getAiSettings,
  getEnvFilesSettings,
  getInboxSettings,
  getNotificationSettings,
  getOrganizationSettings,
  getPreferencesSettings,
  getSupportSettings
} from "@/lib/settings/data";

export const metadata: Metadata = {
  title: "Settings",
  description: "Workspace settings — billing, payments, support, notifications, integrations, and advanced controls."
};

type SettingsSectionPageProps = {
  params: Promise<{ orgId: string; section: string }>;
};

const sectionCopy: Record<SettingsSection, { title: string; description: string }> = {
  preferences: {
    title: "Preferences",
    description: "Profile photo, theme, timezone, Vercel project access, and account preferences."
  },
  ai: {
    title: "AI Settings",
    description: "Cofounder Review Bot, suggested tasks, queue messages, prompt personalization, model choice, and usage visibility."
  },
  "env-files": {
    title: "Env Files & Secrets",
    description: "Upload env files, store secrets, and push sanitized values to your deployment. All credentials are write-only."
  },
  notifications: {
    title: "Notifications",
    description: "Desktop alerts, email task updates, billing email, and in-app mention preferences."
  },
  organization: {
    title: "Organization",
    description: "Company profile, context imports, members, join/create organization surfaces, and admin metadata."
  },
  inbox: {
    title: "Inbox",
    description: "Domains, DNS setup, email provider state, and agent inbox addresses."
  },
  support: {
    title: "Support",
    description: "Support widget state, support agent, and customer-response readiness."
  },
  payments: {
    title: "Stripe/Payments",
    description: "Stripe test/live key status, webhook status, and payment mode readiness."
  },
  billing: {
    title: "Billing",
    description: "Trial, Pro, and Team plan model with usage, included credits, upgrade flow, and billing dashboard link."
  },
  advanced: {
    title: "Advanced",
    description: "Own Supabase project import, own GitHub repo switch, managed asset status, and destructive confirmations."
  }
};

export default async function SettingsSectionPage({ params }: SettingsSectionPageProps) {
  const { orgId, section } = await params;
  if (!isSettingsSection(section)) notFound();
  const copy = sectionCopy[section];

  return (
    <SettingsShell orgId={orgId} activeSection={section} title={copy.title} description={copy.description}>
      {await renderSection(orgId, section)}
    </SettingsShell>
  );
}

async function renderSection(orgId: string, section: SettingsSection) {
  if (section === "preferences") return <PreferencesSettingsForm orgId={orgId} initialData={await getPreferencesSettings(orgId)} />;
  if (section === "ai") return <AiSettingsForm orgId={orgId} initialData={await getAiSettings(orgId)} />;
  if (section === "env-files") return <EnvFilesSettingsPanel orgId={orgId} initialData={await getEnvFilesSettings(orgId)} />;
  if (section === "notifications") return <NotificationSettingsForm orgId={orgId} initialData={await getNotificationSettings(orgId)} />;
  if (section === "organization") return <OrganizationSettingsForm orgId={orgId} initialData={await getOrganizationSettings(orgId)} />;
  if (section === "inbox") return <InboxSettingsPanel orgId={orgId} initialData={await getInboxSettings(orgId)} />;
  if (section === "support") return <SupportSettingsPanel data={await getSupportSettings(orgId)} />;
  if (section === "payments") {
    const stripe = await getIntegrationDetail(orgId, "stripe");
    if (!stripe) notFound();
    return <PaymentsSettingsPanel orgId={orgId} initialData={stripe} />;
  }
  if (section === "billing") return <BillingDashboard orgId={orgId} initialData={await getBillingData(orgId)} />;
  return <AdvancedSettingsPanel orgId={orgId} initialData={await getAdvancedSettings(orgId)} />;
}

function isSettingsSection(value: string): value is SettingsSection {
  return settingsNavItems.some((item) => item.section === value);
}

