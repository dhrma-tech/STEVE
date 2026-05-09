import { requireOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { integrationProviders } from "@/lib/onboarding/definitions";

const json = (value: unknown) => JSON.stringify(value);

export const providerCatalog = [
  { provider: "github", label: "GitHub", description: "Managed repository status, ownership graduation, and own-repo connection.", category: "Code" },
  { provider: "vercel", label: "Vercel", description: "Managed project, staging/production links, and env export state.", category: "Hosting" },
  { provider: "supabase", label: "Supabase", description: "Managed database status and bring-your-own project option.", category: "Database" },
  { provider: "stripe", label: "Stripe", description: "Test/live keys, webhook state, and payments readiness.", category: "Payments" },
  { provider: "postiz", label: "Postiz", description: "Social publishing channels for content and launch workflows.", category: "Marketing" },
  { provider: "apify", label: "Apify", description: "Prospect and content signal collection for marketing and sales.", category: "Signals" },
  { provider: "domain", label: "Domain", description: "Domain registration and DNS setup status.", category: "Domain" },
  { provider: "email", label: "Email", description: "Transactional/outbound email and inbox routing status.", category: "Email" },
  { provider: "posthog", label: "PostHog", description: "Analytics placeholder backed by provider records.", category: "Analytics" },
  { provider: "sentry", label: "Sentry", description: "Error monitoring placeholder backed by provider records.", category: "Monitoring" },
  { provider: "datadog", label: "Datadog", description: "Infrastructure monitoring placeholder backed by provider records.", category: "Monitoring" },
  { provider: "support", label: "Support Widget", description: "Customer support widget and support agent handoff.", category: "Support" }
] as const;

export type IntegrationsData = Awaited<ReturnType<typeof getIntegrationsData>>;
export type IntegrationDetailData = Awaited<ReturnType<typeof getIntegrationDetail>>;
export type PostizIntegrationData = Awaited<ReturnType<typeof getPostizIntegration>>;

export async function ensureIntegrationRecords(orgId: string) {
  for (const provider of integrationProviders) {
    await prisma.integration.upsert({
      where: {
        organizationId_provider_externalId: {
          organizationId: orgId,
          provider,
          externalId: `sandbox-${provider}`
        }
      },
      update: {},
      create: {
        organizationId: orgId,
        provider,
        status: "sandbox",
        mode: "sandbox",
        displayName: `${labelFor(provider)} sandbox`,
        externalId: `sandbox-${provider}`,
        configJson: json(defaultConfig(provider)),
        lastCheckedAt: new Date()
      }
    });
  }
}

export async function getIntegrationsData(orgId: string) {
  await requireOrgAdmin(orgId);
  await ensureIntegrationRecords(orgId);
  const [integrations, secretCounts] = await Promise.all([
    prisma.integration.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { secrets: true, events: true } } },
      orderBy: [{ provider: "asc" }, { createdAt: "asc" }]
    }),
    prisma.secret.groupBy({
      by: ["integrationId"],
      where: { organizationId: orgId },
      _count: { id: true }
    })
  ]);
  const secretCountByIntegration = new Map(secretCounts.map((item) => [item.integrationId, item._count.id]));

  return {
    providers: providerCatalog.map((provider) => {
      const integration = integrations.find((item) => item.provider === provider.provider);
      return {
        ...provider,
        integration: integration
          ? {
              id: integration.id,
              status: integration.status,
              mode: integration.mode,
              displayName: integration.displayName,
              config: parseJsonObject(integration.configJson),
              lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null,
              errorMessage: integration.errorMessage,
              secretsCount: secretCountByIntegration.get(integration.id) ?? integration._count.secrets,
              eventsCount: integration._count.events
            }
          : null
      };
    }),
    counts: {
      total: integrations.length,
      connected: integrations.filter((item) => item.status === "connected").length,
      sandbox: integrations.filter((item) => item.mode === "sandbox").length,
      needsSetup: integrations.filter((item) => ["needs_setup", "disconnected"].includes(item.status)).length
    }
  };
}

export async function getIntegrationDetail(orgId: string, provider: string) {
  await requireOrgAdmin(orgId);
  await ensureIntegrationRecords(orgId);
  const integration = await getProviderIntegration(orgId, provider);
  if (!integration) return null;

  const [events, secrets] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: { integrationId: integration.id },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.secret.findMany({
      where: { organizationId: orgId, integrationId: integration.id },
      orderBy: [{ environment: "asc" }, { key: "asc" }]
    })
  ]);
  const catalog = providerCatalog.find((item) => item.provider === provider);

  return {
    provider,
    label: catalog?.label ?? labelFor(provider),
    description: catalog?.description ?? "",
    category: catalog?.category ?? "Integration",
    integration: {
      id: integration.id,
      status: integration.status,
      mode: integration.mode,
      displayName: integration.displayName,
      externalId: integration.externalId,
      config: parseJsonObject(integration.configJson),
      lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null,
      errorMessage: integration.errorMessage
    },
    secrets: secrets.map((secret) => ({
      id: secret.id,
      key: secret.key,
      environment: secret.environment,
      hasValue: Boolean(secret.valueCiphertext),
      valuePreview: "••••••••",
      updatedAt: secret.updatedAt.toISOString()
    })),
    events: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      status: event.status,
      payload: parseJsonObject(event.payloadJson),
      createdAt: event.createdAt.toISOString()
    }))
  };
}

export async function connectIntegration({
  orgId,
  provider,
  config = {}
}: {
  orgId: string;
  provider: string;
  config?: Record<string, unknown>;
}) {
  await requireOrgAdmin(orgId);
  const integration = await ensureProvider(orgId, provider);
  const previousConfig = parseJsonObject(integration.configJson);
  const nextConfig = {
    ...defaultConfig(provider),
    ...previousConfig,
    ...config,
    connectedAt: new Date().toISOString(),
    sandbox: true
  };
  await prisma.$transaction([
    prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "connected",
        mode: "sandbox",
        configJson: json(nextConfig),
        lastCheckedAt: new Date(),
        errorMessage: null
      }
    }),
    prisma.integrationEvent.create({
      data: {
        organizationId: orgId,
        integrationId: integration.id,
        eventType: `${provider}.connected`,
        status: "connected_sandbox",
        payloadJson: json({ valuesReturned: false, configKeys: Object.keys(config) })
      }
    })
  ]);

  return getIntegrationDetail(orgId, provider);
}

export async function disconnectIntegration({ orgId, provider }: { orgId: string; provider: string }) {
  await requireOrgAdmin(orgId);
  const integration = await ensureProvider(orgId, provider);
  await prisma.$transaction([
    prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "disconnected",
        mode: "sandbox",
        configJson: json({ ...parseJsonObject(integration.configJson), disconnectedAt: new Date().toISOString() }),
        lastCheckedAt: new Date()
      }
    }),
    prisma.integrationEvent.create({
      data: {
        organizationId: orgId,
        integrationId: integration.id,
        eventType: `${provider}.disconnected`,
        status: "disconnected",
        payloadJson: json({})
      }
    })
  ]);

  return getIntegrationDetail(orgId, provider);
}

export async function checkIntegration({ orgId, provider }: { orgId: string; provider: string }) {
  await requireOrgAdmin(orgId);
  const integration = await ensureProvider(orgId, provider);
  const nextStatus = integration.status === "disconnected" ? "needs_setup" : integration.status === "sandbox" ? "sandbox" : "connected";
  await prisma.$transaction([
    prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: nextStatus,
        lastCheckedAt: new Date(),
        errorMessage: null
      }
    }),
    prisma.integrationEvent.create({
      data: {
        organizationId: orgId,
        integrationId: integration.id,
        eventType: `${provider}.checked`,
        status: nextStatus,
        payloadJson: json({ checkedAt: new Date().toISOString(), sandbox: integration.mode === "sandbox" })
      }
    })
  ]);

  return getIntegrationDetail(orgId, provider);
}

export async function getPostizIntegration(orgId: string) {
  const detail = await getIntegrationDetail(orgId, "postiz");
  if (!detail) return null;
  const channels = Array.isArray(detail.integration.config.channels) ? detail.integration.config.channels : [];
  return {
    ...detail,
    channels: channels.map((channel) => normalizeChannel(channel)),
    publishing: {
      status: detail.integration.status,
      mode: detail.integration.mode,
      queueLabel: detail.integration.status === "connected" ? "Ready for social publishing tasks" : "Connect sandbox channels to unlock social publishing"
    }
  };
}

export async function addPostizChannel({
  orgId,
  channelType,
  displayName
}: {
  orgId: string;
  channelType: string;
  displayName: string;
}) {
  await requireOrgAdmin(orgId);
  const integration = await ensureProvider(orgId, "postiz");
  const config = parseJsonObject(integration.configJson);
  const channels = Array.isArray(config.channels) ? config.channels.map((channel) => normalizeChannel(channel)) : [];
  const channel = {
    id: `channel-${Date.now()}`,
    channelType: channelType.trim().toLowerCase().slice(0, 40) || "x",
    displayName: displayName.trim().slice(0, 80) || "Social channel",
    status: "connected",
    mode: "sandbox",
    createdAt: new Date().toISOString()
  };

  await prisma.$transaction([
    prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "connected",
        mode: "sandbox",
        configJson: json({ ...config, channels: [channel, ...channels], sandbox: true }),
        lastCheckedAt: new Date()
      }
    }),
    prisma.integrationEvent.create({
      data: {
        organizationId: orgId,
        integrationId: integration.id,
        eventType: "postiz.channel.connected",
        status: "connected",
        payloadJson: json({ channelType: channel.channelType, displayName: channel.displayName })
      }
    })
  ]);

  return getPostizIntegration(orgId);
}

async function ensureProvider(orgId: string, provider: string) {
  await ensureIntegrationRecords(orgId);
  const existing = await getProviderIntegration(orgId, provider);
  if (existing) return existing;
  return prisma.integration.create({
    data: {
      organizationId: orgId,
      provider,
      status: "sandbox",
      mode: "sandbox",
      displayName: `${labelFor(provider)} sandbox`,
      externalId: `sandbox-${provider}`,
      configJson: json(defaultConfig(provider)),
      lastCheckedAt: new Date()
    }
  });
}

async function getProviderIntegration(orgId: string, provider: string) {
  return prisma.integration.findFirst({
    where: { organizationId: orgId, provider },
    orderBy: { updatedAt: "desc" }
  });
}

function defaultConfig(provider: string) {
  if (provider === "vercel") {
    return { sandbox: true, project: "cofounder-sandbox", productionUrl: "https://cofounder.example", stagingUrl: "https://staging.cofounder.example" };
  }
  if (provider === "github") {
    return { sandbox: true, managedRepo: "cofounder/managed-sandbox", graduationAvailable: true };
  }
  if (provider === "supabase") {
    return { sandbox: true, managedProject: "cofounder-sandbox-db", bringYourOwnAvailable: true };
  }
  if (provider === "stripe") {
    return { sandbox: true, testMode: "needs_keys", liveMode: "not_configured", webhookStatus: "sandbox" };
  }
  if (provider === "postiz") {
    return { sandbox: true, channels: [] };
  }
  return { sandbox: true };
}

function labelFor(provider: string) {
  return providerCatalog.find((item) => item.provider === provider)?.label ?? provider;
}

function normalizeChannel(value: unknown) {
  const channel = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    id: typeof channel.id === "string" ? channel.id : `channel-${Math.random().toString(36).slice(2)}`,
    channelType: typeof channel.channelType === "string" ? channel.channelType : "x",
    displayName: typeof channel.displayName === "string" ? channel.displayName : "Social channel",
    status: typeof channel.status === "string" ? channel.status : "connected",
    mode: typeof channel.mode === "string" ? channel.mode : "sandbox",
    createdAt: typeof channel.createdAt === "string" ? channel.createdAt : new Date().toISOString()
  };
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
