import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { requireOrgAdmin, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ensureIntegrationRecords, providerCatalog } from "@/lib/integrations/data";

const json = (value: unknown) => JSON.stringify(value);

const userPreferenceDefaults = {
  theme: "system",
  shadowsEnabled: true,
  aiModel: "claude-sonnet-sandbox",
  promptPersonalization: "",
  suggestedTasksEnabled: true,
  queueMessagesEnabled: true,
  reviewBotMode: "blockers_only"
};

export type PreferencesSettingsData = Awaited<ReturnType<typeof getPreferencesSettings>>;
export type AiSettingsData = Awaited<ReturnType<typeof getAiSettings>>;
export type EnvFilesSettingsData = Awaited<ReturnType<typeof getEnvFilesSettings>>;
export type OrganizationSettingsData = Awaited<ReturnType<typeof getOrganizationSettings>>;
export type InboxSettingsData = Awaited<ReturnType<typeof getInboxSettings>>;
export type NotificationSettingsData = Awaited<ReturnType<typeof getNotificationSettings>>;
export type SupportSettingsData = Awaited<ReturnType<typeof getSupportSettings>>;
export type AdvancedSettingsData = Awaited<ReturnType<typeof getAdvancedSettings>>;

export async function getPreferencesSettings(orgId: string) {
  const { user, membership, organization } = await requireOrgMember(orgId);
  const [preferences, vercel, profile] = await Promise.all([
    ensureUserPreference(user.id),
    getIntegration(orgId, "vercel"),
    prisma.user.findUnique({ where: { id: user.id } })
  ]);
  const timezone = profile?.timezone ?? preferences.timezone ?? "UTC";

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.preferredName ?? profile?.name ?? "Founder",
      preferredName: user.preferredName ?? preferences.preferredName ?? "",
      avatarUrl: user.avatarUrl,
      timezone,
      isSandbox: user.isSandbox
    },
    organization: {
      id: organization.id,
      name: organization.name,
      role: membership.role
    },
    preferences: {
      theme: preferences.theme,
      shadowsEnabled: preferences.shadowsEnabled,
      timezone,
      preferredName: preferences.preferredName ?? user.preferredName ?? ""
    },
    vercel: vercel ? serializeIntegrationSummary(vercel) : null
  };
}

export async function updatePreferencesSettings({
  orgId,
  preferredName,
  timezone,
  theme,
  shadowsEnabled
}: {
  orgId: string;
  preferredName?: string | null;
  timezone?: string | null;
  theme?: string | null;
  shadowsEnabled?: boolean | null;
}) {
  const { user } = await requireOrgMember(orgId);
  const nextPreferredName = preferredName !== undefined ? preferredName?.trim().slice(0, 80) || null : undefined;
  const nextTimezone = timezone !== undefined ? timezone?.trim().slice(0, 80) || null : undefined;
  const nextTheme = theme && ["light", "system", "dark"].includes(theme) ? theme : undefined;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        ...(nextPreferredName !== undefined ? { preferredName: nextPreferredName } : {}),
        ...(nextTimezone !== undefined ? { timezone: nextTimezone } : {})
      }
    }),
    prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {
        ...(nextPreferredName !== undefined ? { preferredName: nextPreferredName } : {}),
        ...(nextTimezone !== undefined ? { timezone: nextTimezone } : {}),
        ...(nextTheme ? { theme: nextTheme } : {}),
        ...(shadowsEnabled !== undefined && shadowsEnabled !== null ? { shadowsEnabled } : {})
      },
      create: {
        userId: user.id,
        preferredName: nextPreferredName,
        timezone: nextTimezone,
        theme: nextTheme ?? userPreferenceDefaults.theme,
        shadowsEnabled: shadowsEnabled ?? userPreferenceDefaults.shadowsEnabled
      }
    })
  ]);

  return getPreferencesSettings(orgId);
}

export async function updateAvatarSettings({
  orgId,
  name,
  mimeType,
  sizeBytes,
  dataUrl
}: {
  orgId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl?: string | null;
}) {
  const { user } = await requireOrgMember(orgId);
  if (mimeType !== "image/webp" || sizeBytes > 5 * 1024 * 1024) {
    return { ok: false as const, reason: "Avatar must be a WebP image under 5MB." };
  }

  const safeDataUrl = dataUrl && dataUrl.startsWith("data:image/webp;base64,") && dataUrl.length < 7_000_000 ? dataUrl : null;
  const avatarUrl = safeDataUrl ?? `/api/orgs/${orgId}/settings/preferences/avatar?name=${encodeURIComponent(name)}`;
  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorUserId: user.id,
      action: "settings.avatar.updated",
      targetType: "user",
      targetId: user.id,
      metadataJson: json({ name, mimeType, sizeBytes, storedAs: safeDataUrl ? "data_url" : "metadata_url" })
    }
  });

  return { ok: true as const, data: await getPreferencesSettings(orgId) };
}

export async function getAiSettings(orgId: string) {
  const { user } = await requireOrgMember(orgId);
  const preferences = await ensureUserPreference(user.id);
  const usage = await getUsageSummary(orgId);

  return {
    suggestedTasksEnabled: preferences.suggestedTasksEnabled,
    queueMessagesEnabled: preferences.queueMessagesEnabled,
    reviewBotMode: preferences.reviewBotMode,
    promptPersonalization: preferences.promptPersonalization ?? "",
    aiModel: preferences.aiModel ?? userPreferenceDefaults.aiModel,
    creditUsage: usage,
    byok: {
      supported: false,
      label: "BYOK is not supported"
    }
  };
}

export async function updateAiSettings({
  orgId,
  suggestedTasksEnabled,
  queueMessagesEnabled,
  reviewBotMode,
  promptPersonalization,
  aiModel
}: {
  orgId: string;
  suggestedTasksEnabled?: boolean | null;
  queueMessagesEnabled?: boolean | null;
  reviewBotMode?: string | null;
  promptPersonalization?: string | null;
  aiModel?: string | null;
}) {
  const { user } = await requireOrgMember(orgId);
  const nextMode = reviewBotMode && ["blockers_only", "every_change", "off"].includes(reviewBotMode) ? reviewBotMode : undefined;
  const nextModel = aiModel && ["claude-sonnet-sandbox", "gpt-5.4-sandbox", "gpt-5.4-mini-sandbox"].includes(aiModel) ? aiModel : undefined;

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      ...(suggestedTasksEnabled !== undefined && suggestedTasksEnabled !== null ? { suggestedTasksEnabled } : {}),
      ...(queueMessagesEnabled !== undefined && queueMessagesEnabled !== null ? { queueMessagesEnabled } : {}),
      ...(nextMode ? { reviewBotMode: nextMode } : {}),
      ...(promptPersonalization !== undefined ? { promptPersonalization: promptPersonalization?.slice(0, 2000) ?? "" } : {}),
      ...(nextModel ? { aiModel: nextModel } : {})
    },
    create: {
      userId: user.id,
      suggestedTasksEnabled: suggestedTasksEnabled ?? userPreferenceDefaults.suggestedTasksEnabled,
      queueMessagesEnabled: queueMessagesEnabled ?? userPreferenceDefaults.queueMessagesEnabled,
      reviewBotMode: nextMode ?? userPreferenceDefaults.reviewBotMode,
      promptPersonalization: promptPersonalization?.slice(0, 2000) ?? "",
      aiModel: nextModel ?? userPreferenceDefaults.aiModel
    }
  });

  return getAiSettings(orgId);
}

export async function getEnvFilesSettings(orgId: string) {
  await requireOrgAdmin(orgId);
  await ensureIntegrationRecords(orgId);
  const [secrets, vercel, events] = await Promise.all([
    prisma.secret.findMany({
      where: { organizationId: orgId },
      include: { integration: true },
      orderBy: [{ environment: "asc" }, { key: "asc" }]
    }),
    getIntegration(orgId, "vercel"),
    prisma.integrationEvent.findMany({
      where: { organizationId: orgId, eventType: { in: ["env_file.uploaded", "secret.pushed"] } },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  return {
    vercel: vercel ? serializeIntegrationSummary(vercel) : null,
    secrets: secrets.map(serializeSecret),
    uploads: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      status: event.status,
      payload: parseJsonObject(event.payloadJson),
      createdAt: event.createdAt.toISOString()
    })),
    exportLinks: [
      { label: "Vercel staging env", href: "#staging-env", status: vercel?.status ?? "sandbox" },
      { label: "Download sanitized .env", href: "#download-env", status: "metadata_only" }
    ]
  };
}

export async function uploadEnvFile({
  orgId,
  fileName,
  content,
  environment,
  pushToVercel
}: {
  orgId: string;
  fileName: string;
  content: string;
  environment: string;
  pushToVercel: boolean;
}) {
  const { user } = await requireOrgAdmin(orgId);
  const secrets = parseEnv(content).slice(0, 80);
  const vercel = await ensureProviderIntegration(orgId, "vercel");

  for (const item of secrets) {
    await writeSecret({
      orgId,
      userId: user.id,
      key: item.key,
      value: item.value,
      environment,
      integrationId: pushToVercel ? vercel.id : null
    });
  }

  await prisma.integrationEvent.create({
    data: {
      organizationId: orgId,
      integrationId: vercel.id,
      eventType: "env_file.uploaded",
      status: pushToVercel ? "pushed_to_vercel_sandbox" : "stored",
      payloadJson: json({
        fileName,
        environment,
        keys: secrets.map((secret) => secret.key),
        valuesReturned: false
      })
    }
  });

  return getEnvFilesSettings(orgId);
}

export async function createSecret({
  orgId,
  key,
  value,
  environment,
  pushToVercel
}: {
  orgId: string;
  key: string;
  value: string;
  environment: string;
  pushToVercel: boolean;
}) {
  const { user } = await requireOrgAdmin(orgId);
  const vercel = pushToVercel ? await ensureProviderIntegration(orgId, "vercel") : null;
  await writeSecret({
    orgId,
    userId: user.id,
    key,
    value,
    environment,
    integrationId: vercel?.id ?? null
  });

  if (vercel) {
    await prisma.integrationEvent.create({
      data: {
        organizationId: orgId,
        integrationId: vercel.id,
        eventType: "secret.pushed",
        status: "pushed_to_vercel_sandbox",
        payloadJson: json({ key: normalizeSecretKey(key), environment, valuesReturned: false })
      }
    });
  }

  return getEnvFilesSettings(orgId);
}

export async function getOrganizationSettings(orgId: string) {
  await requireOrgAdmin(orgId);
  const [organization, memberships, imports] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    }),
    prisma.onboardingAnswer.findMany({
      where: { organizationId: orgId, questionKey: { startsWith: "context_import_" } },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      stage: organization.stage,
      status: organization.status
    },
    members: memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      acceptedAt: membership.acceptedAt?.toISOString() ?? null,
      user: {
        id: membership.user.id,
        name: membership.user.preferredName ?? membership.user.name ?? membership.user.email ?? "Member",
        email: membership.user.email,
        avatarUrl: membership.user.avatarUrl
      }
    })),
    contextImports: imports.map((item) => ({
      id: item.id,
      source: item.questionKey.replace("context_import_", ""),
      content: item.freeText ?? "",
      updatedAt: item.updatedAt.toISOString()
    }))
  };
}

export async function updateOrganizationSettings({
  orgId,
  name,
  description
}: {
  orgId: string;
  name?: string | null;
  description?: string | null;
}) {
  const { user } = await requireOrgAdmin(orgId);
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(name !== undefined ? { name: name?.trim().slice(0, 80) || "Untitled company" } : {}),
      ...(description !== undefined ? { description: description?.trim().slice(0, 2000) || null } : {})
    }
  });
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorUserId: user.id,
      action: "settings.organization.updated",
      targetType: "organization",
      targetId: orgId
    }
  });
  return getOrganizationSettings(orgId);
}

export async function importOrganizationContext({
  orgId,
  source,
  content
}: {
  orgId: string;
  source: string;
  content: string;
}) {
  const { user } = await requireOrgAdmin(orgId);
  const normalizedSource = normalizeSource(source);
  const key = `context_import_${normalizedSource}`;
  await prisma.onboardingAnswer.upsert({
    where: { organizationId_questionKey: { organizationId: orgId, questionKey: key } },
    update: {
      freeText: content.slice(0, 12_000),
      answeredByUserId: user.id,
      aiDecided: false
    },
    create: {
      organizationId: orgId,
      questionKey: key,
      questionText: `Context import from ${source}`,
      freeText: content.slice(0, 12_000),
      answeredByUserId: user.id
    }
  });
  return getOrganizationSettings(orgId);
}

export async function getInboxSettings(orgId: string) {
  await requireOrgAdmin(orgId);
  const [domains, inboxes, agents] = await Promise.all([
    prisma.inboxDomain.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" }
    }),
    prisma.agentInbox.findMany({
      where: { organizationId: orgId },
      include: { agent: true, inboxDomain: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.agent.findMany({
      where: { organizationId: orgId, archivedAt: null },
      include: { department: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    })
  ]);

  return {
    domains: domains.map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      status: domain.status,
      dnsRecords: parseJsonObject(domain.dnsRecordsJson),
      createdAt: domain.createdAt.toISOString(),
      updatedAt: domain.updatedAt.toISOString()
    })),
    agentInboxes: inboxes.map((inbox) => ({
      id: inbox.id,
      address: inbox.address,
      status: inbox.status,
      domain: inbox.inboxDomain ? { id: inbox.inboxDomain.id, domain: inbox.inboxDomain.domain, status: inbox.inboxDomain.status } : null,
      agent: {
        id: inbox.agent.id,
        name: inbox.agent.name,
        status: inbox.agent.status
      },
      updatedAt: inbox.updatedAt.toISOString()
    })),
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      department: agent.department ? { id: agent.department.id, name: agent.department.name } : null
    }))
  };
}

export async function createInboxDomain({ orgId, domain }: { orgId: string; domain: string }) {
  await requireOrgAdmin(orgId);
  const normalizedDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  await prisma.inboxDomain.upsert({
    where: { organizationId_domain: { organizationId: orgId, domain: normalizedDomain } },
    update: {
      status: "pending",
      dnsRecordsJson: json(dnsRecordsFor(normalizedDomain))
    },
    create: {
      organizationId: orgId,
      domain: normalizedDomain,
      status: "pending",
      dnsRecordsJson: json(dnsRecordsFor(normalizedDomain))
    }
  });
  return getInboxSettings(orgId);
}

export async function assignAgentInbox({
  orgId,
  agentId,
  address
}: {
  orgId: string;
  agentId: string;
  address: string;
}) {
  await requireOrgAdmin(orgId);
  const agent = await prisma.agent.findFirst({ where: { id: agentId, organizationId: orgId, archivedAt: null } });
  if (!agent) return null;
  const normalizedAddress = address.toLowerCase().trim();
  const domainName = normalizedAddress.split("@")[1] ?? "";
  const domain = domainName
    ? await prisma.inboxDomain.findFirst({ where: { organizationId: orgId, domain: domainName } })
    : null;

  await prisma.agentInbox.upsert({
    where: { organizationId_address: { organizationId: orgId, address: normalizedAddress } },
    update: {
      agentId: agent.id,
      inboxDomainId: domain?.id ?? null,
      status: "active"
    },
    create: {
      organizationId: orgId,
      agentId: agent.id,
      inboxDomainId: domain?.id ?? null,
      address: normalizedAddress,
      status: "active"
    }
  });

  return getInboxSettings(orgId);
}

export async function getNotificationSettings(orgId: string) {
  const { user } = await requireOrgMember(orgId);
  const preferences = await ensureNotificationPreference(user.id, orgId);
  return {
    desktopAlerts: preferences.desktopAlerts,
    emailTaskUpdates: preferences.emailTaskUpdates,
    emailBilling: preferences.emailBilling,
    inAppMentions: preferences.inAppMentions
  };
}

export async function updateNotificationSettings({
  orgId,
  desktopAlerts,
  emailTaskUpdates,
  emailBilling,
  inAppMentions
}: {
  orgId: string;
  desktopAlerts?: boolean | null;
  emailTaskUpdates?: boolean | null;
  emailBilling?: boolean | null;
  inAppMentions?: boolean | null;
}) {
  const { user } = await requireOrgMember(orgId);
  await prisma.notificationPreference.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    update: {
      ...(desktopAlerts !== undefined && desktopAlerts !== null ? { desktopAlerts } : {}),
      ...(emailTaskUpdates !== undefined && emailTaskUpdates !== null ? { emailTaskUpdates } : {}),
      ...(emailBilling !== undefined && emailBilling !== null ? { emailBilling } : {}),
      ...(inAppMentions !== undefined && inAppMentions !== null ? { inAppMentions } : {})
    },
    create: {
      userId: user.id,
      organizationId: orgId,
      desktopAlerts: desktopAlerts ?? false,
      emailTaskUpdates: emailTaskUpdates ?? true,
      emailBilling: emailBilling ?? true,
      inAppMentions: inAppMentions ?? true
    }
  });
  return getNotificationSettings(orgId);
}

export async function getSupportSettings(orgId: string) {
  await requireOrgMember(orgId);
  await ensureIntegrationRecords(orgId);
  const [support, supportAgent, recentEvents] = await Promise.all([
    getIntegration(orgId, "support"),
    prisma.agent.findFirst({
      where: { organizationId: orgId, department: { slug: "support" }, archivedAt: null },
      include: { inboxes: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    }),
    prisma.integrationEvent.findMany({
      where: { organizationId: orgId, eventType: { contains: "support" } },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  return {
    widget: {
      status: support?.status ?? "sandbox",
      mode: support?.mode ?? "sandbox",
      displayName: support?.displayName ?? "support sandbox",
      configured: Boolean(parseJsonObject(support?.configJson).widgetEnabled)
    },
    supportAgent: supportAgent
      ? {
          id: supportAgent.id,
          name: supportAgent.name,
          status: supportAgent.status,
          inboxes: supportAgent.inboxes.map((inbox) => ({ id: inbox.id, address: inbox.address, status: inbox.status }))
        }
      : null,
    events: recentEvents.map((event) => ({
      id: event.id,
      status: event.status,
      payload: parseJsonObject(event.payloadJson),
      createdAt: event.createdAt.toISOString()
    }))
  };
}

export async function getAdvancedSettings(orgId: string) {
  await requireOrgAdmin(orgId);
  await ensureIntegrationRecords(orgId);
  const [github, supabase, vercel, auditLogs] = await Promise.all([
    getIntegration(orgId, "github"),
    getIntegration(orgId, "supabase"),
    getIntegration(orgId, "vercel"),
    prisma.auditLog.findMany({
      where: { organizationId: orgId, action: { in: ["settings.advanced.import_supabase", "settings.advanced.switch_repo"] } },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  return {
    github: github ? serializeIntegrationSummary(github) : null,
    supabase: supabase ? serializeIntegrationSummary(supabase) : null,
    vercel: vercel ? serializeIntegrationSummary(vercel) : null,
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      metadata: parseJsonObject(log.metadataJson),
      createdAt: log.createdAt.toISOString()
    })),
    confirmations: {
      importSupabase: "IMPORT SUPABASE",
      switchRepo: "SWITCH REPO"
    }
  };
}

export async function importOwnSupabase({
  orgId,
  projectUrl,
  confirmation
}: {
  orgId: string;
  projectUrl: string;
  confirmation: string;
}) {
  const { user } = await requireOrgAdmin(orgId);
  if (confirmation !== "IMPORT SUPABASE") {
    return { ok: false as const, reason: "Type IMPORT SUPABASE to confirm." };
  }

  const supabase = await ensureProviderIntegration(orgId, "supabase");
  const config = { ...parseJsonObject(supabase.configJson), managed: false, projectUrl: projectUrl.trim(), importedAt: new Date().toISOString() };
  await prisma.$transaction([
    prisma.integration.update({
      where: { id: supabase.id },
      data: {
        mode: "external",
        status: "connected",
        configJson: json(config),
        lastCheckedAt: new Date()
      }
    }),
    prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: user.id,
        action: "settings.advanced.import_supabase",
        targetType: "integration",
        targetId: supabase.id,
        metadataJson: json({ projectUrl: projectUrl.trim() })
      }
    })
  ]);

  return { ok: true as const, data: await getAdvancedSettings(orgId) };
}

export async function switchOwnRepo({
  orgId,
  repoUrl,
  confirmation
}: {
  orgId: string;
  repoUrl: string;
  confirmation: string;
}) {
  const { user } = await requireOrgAdmin(orgId);
  if (confirmation !== "SWITCH REPO") {
    return { ok: false as const, reason: "Type SWITCH REPO to confirm." };
  }

  const github = await ensureProviderIntegration(orgId, "github");
  const config = { ...parseJsonObject(github.configJson), managed: false, repoUrl: repoUrl.trim(), switchedAt: new Date().toISOString() };
  await prisma.$transaction([
    prisma.integration.update({
      where: { id: github.id },
      data: {
        mode: "external",
        status: "connected",
        configJson: json(config),
        lastCheckedAt: new Date()
      }
    }),
    prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: user.id,
        action: "settings.advanced.switch_repo",
        targetType: "integration",
        targetId: github.id,
        metadataJson: json({ repoUrl: repoUrl.trim() })
      }
    })
  ]);

  return { ok: true as const, data: await getAdvancedSettings(orgId) };
}

async function ensureUserPreference(userId: string) {
  return prisma.userPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...userPreferenceDefaults
    }
  });
}

async function ensureNotificationPreference(userId: string, orgId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    update: {},
    create: {
      userId,
      organizationId: orgId,
      desktopAlerts: false,
      emailTaskUpdates: true,
      emailBilling: true,
      inAppMentions: true
    }
  });
}

async function ensureProviderIntegration(orgId: string, provider: string) {
  await ensureIntegrationRecords(orgId);
  const existing = await getIntegration(orgId, provider);
  if (existing) return existing;
  return prisma.integration.create({
    data: {
      organizationId: orgId,
      provider,
      status: "sandbox",
      mode: "sandbox",
      displayName: `${provider} sandbox`,
      externalId: `sandbox-${provider}`,
      configJson: json({ sandbox: true }),
      lastCheckedAt: new Date()
    }
  });
}

async function getIntegration(orgId: string, provider: string) {
  return prisma.integration.findFirst({
    where: { organizationId: orgId, provider },
    orderBy: { updatedAt: "desc" }
  });
}

async function writeSecret({
  orgId,
  userId,
  key,
  value,
  environment,
  integrationId
}: {
  orgId: string;
  userId: string;
  key: string;
  value: string;
  environment: string;
  integrationId: string | null;
}) {
  const normalizedKey = normalizeSecretKey(key);
  const normalizedEnvironment = normalizeEnvironment(environment);
  const ciphertext = redactedCiphertext(value);
  return prisma.secret.upsert({
    where: { organizationId_environment_key: { organizationId: orgId, environment: normalizedEnvironment, key: normalizedKey } },
    update: {
      valueCiphertext: ciphertext,
      integrationId,
      isWriteOnly: true,
      rotatedAt: new Date()
    },
    create: {
      organizationId: orgId,
      integrationId,
      key: normalizedKey,
      valueCiphertext: ciphertext,
      isWriteOnly: true,
      environment: normalizedEnvironment,
      createdByUserId: userId
    }
  });
}

function serializeSecret(secret: Prisma.SecretGetPayload<{ include: { integration: true } }>) {
  return {
    id: secret.id,
    key: secret.key,
    environment: secret.environment,
    integration: secret.integration ? { id: secret.integration.id, provider: secret.integration.provider, status: secret.integration.status } : null,
    isWriteOnly: secret.isWriteOnly,
    hasValue: Boolean(secret.valueCiphertext),
    valuePreview: "••••••••",
    createdAt: secret.createdAt.toISOString(),
    updatedAt: secret.updatedAt.toISOString(),
    rotatedAt: secret.rotatedAt?.toISOString() ?? null
  };
}

function serializeIntegrationSummary(integration: NonNullable<Awaited<ReturnType<typeof getIntegration>>>) {
  const config = parseJsonObject(integration.configJson);
  return {
    id: integration.id,
    provider: integration.provider,
    label: providerCatalog.find((item) => item.provider === integration.provider)?.label ?? integration.displayName ?? integration.provider,
    status: integration.status,
    mode: integration.mode,
    displayName: integration.displayName,
    config,
    lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null,
    errorMessage: integration.errorMessage
  };
}

async function getUsageSummary(orgId: string) {
  const [billing, usage] = await Promise.all([
    prisma.billingAccount.findUnique({ where: { organizationId: orgId } }),
    prisma.usageRecord.groupBy({
      by: ["category"],
      where: { organizationId: orgId },
      _sum: { costCents: true, quantity: true }
    })
  ]);

  const usedCents = usage.reduce((sum, item) => sum + (item._sum.costCents ?? 0), 0);
  return {
    includedUsageCents: billing?.includedUsageCents ?? 0,
    usedCents,
    remainingCents: Math.max((billing?.includedUsageCents ?? 0) - usedCents, 0),
    categories: usage.map((item) => ({
      category: item.category,
      quantity: item._sum.quantity ?? 0,
      costCents: item._sum.costCents ?? 0
    }))
  };
}

function parseEnv(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const [key, ...valueParts] = line.split("=");
      return {
        key: normalizeSecretKey(key),
        value: valueParts.join("=").trim().replace(/^["']|["']$/g, "")
      };
    })
    .filter((item) => item.key && item.value);
}

function normalizeSecretKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 80);
}

function normalizeEnvironment(value: string) {
  return ["development", "test", "staging", "production"].includes(value) ? value : "staging";
}

function normalizeSource(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "other";
}

function redactedCiphertext(value: string) {
  const digest = createHash("sha256").update(value).digest("hex");
  return `redacted:sha256:${digest}`;
}

function dnsRecordsFor(domain: string) {
  return {
    mx: [{ type: "MX", host: domain, value: "10 inbound.cofounder.local", status: "pending" }],
    txt: [{ type: "TXT", host: `_cofounder.${domain}`, value: `cofounder-verify=${createHash("sha1").update(domain).digest("hex").slice(0, 12)}`, status: "pending" }]
  };
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
