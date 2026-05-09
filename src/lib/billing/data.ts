import { ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const planCatalog = [
  {
    plan: "trial",
    label: "Trial",
    baseMonthlyCents: 0,
    includedUsageCents: 1500,
    description: "Sandbox company-building access while onboarding."
  },
  {
    plan: "pro",
    label: "Pro",
    baseMonthlyCents: 2000,
    includedUsageCents: 5000,
    description: "Founder plan with higher included execution room."
  },
  {
    plan: "team",
    label: "Team",
    baseMonthlyCents: 5000,
    includedUsageCents: 15000,
    description: "Collaborative approvals, members, and shared operating cadence."
  }
] as const;

const usageCategories = [
  { category: "tokens", label: "AI tokens", unit: "tokens", defaultQuantity: 42_000, defaultCostCents: 620 },
  { category: "compute", label: "Compute", unit: "minutes", defaultQuantity: 74, defaultCostCents: 410 },
  { category: "db", label: "Database", unit: "MB-hours", defaultQuantity: 180, defaultCostCents: 130 },
  { category: "support", label: "Customer support", unit: "tickets", defaultQuantity: 4, defaultCostCents: 90 },
  { category: "ad_spend", label: "Ad spend", unit: "USD", defaultQuantity: 0, defaultCostCents: 0 },
  { category: "data", label: "Data purchasing", unit: "records", defaultQuantity: 120, defaultCostCents: 240 }
] as const;

export type BillingData = Awaited<ReturnType<typeof getBillingData>>;

export async function getBillingData(orgId: string) {
  await requireBillingAdmin(orgId);
  const account = await ensureBillingAccount(orgId);
  await ensureUsageRecords(orgId);
  const usageRecords = await prisma.usageRecord.findMany({
    where: { organizationId: orgId },
    orderBy: { occurredAt: "desc" },
    take: 60
  });
  const totals = usageCategories.map((category) => {
    const records = usageRecords.filter((record) => record.category === category.category);
    return {
      category: category.category,
      label: category.label,
      unit: category.unit,
      quantity: records.reduce((sum, record) => sum + record.quantity, 0),
      costCents: records.reduce((sum, record) => sum + record.costCents, 0)
    };
  });
  const usedCents = totals.reduce((sum, item) => sum + item.costCents, 0);

  return {
    account: {
      id: account.id,
      plan: account.plan,
      status: account.status,
      stripeCustomerId: account.stripeCustomerId,
      stripeSubscriptionId: account.stripeSubscriptionId,
      includedUsageCents: account.includedUsageCents,
      baseMonthlyCents: account.baseMonthlyCents,
      trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    },
    plans: planCatalog,
    usage: {
      usedCents,
      includedUsageCents: account.includedUsageCents,
      remainingCents: Math.max(account.includedUsageCents - usedCents, 0),
      overageCents: Math.max(usedCents - account.includedUsageCents, 0),
      categories: totals,
      records: usageRecords.map((record) => ({
        id: record.id,
        category: record.category,
        quantity: record.quantity,
        unit: record.unit,
        costCents: record.costCents,
        sourceId: record.sourceId,
        occurredAt: record.occurredAt.toISOString(),
        createdAt: record.createdAt.toISOString()
      }))
    },
    dashboardLink: `/org/${orgId}/settings/billing#dashboard`,
    stripe: {
      mode: "sandbox",
      checkoutAvailable: false,
      message: "Stripe checkout is sandboxed until live credentials are supplied in Payments settings."
    }
  };
}

export async function upgradeBillingPlan({
  orgId,
  plan,
  confirmed
}: {
  orgId: string;
  plan: string;
  confirmed: boolean;
}) {
  if (!confirmed) {
    return { ok: false as const, reason: "Upgrade requires confirmation." };
  }

  const { user } = await requireBillingAdmin(orgId);
  const selected = planCatalog.find((item) => item.plan === plan);
  if (!selected || selected.plan === "trial") {
    return { ok: false as const, reason: "Select Pro or Team." };
  }

  const account = await ensureBillingAccount(orgId);
  await prisma.$transaction([
    prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        plan: selected.plan,
        status: "active",
        includedUsageCents: selected.includedUsageCents,
        baseMonthlyCents: selected.baseMonthlyCents,
        stripeCustomerId: account.stripeCustomerId ?? `cus_sandbox_${orgId.slice(-8)}`,
        stripeSubscriptionId: account.stripeSubscriptionId ?? `sub_sandbox_${Date.now()}`
      }
    }),
    prisma.organization.update({
      where: { id: orgId },
      data: {
        currentPlan: selected.plan,
        trialEndsAt: null
      }
    }),
    prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: user.id,
        action: "billing.plan.upgraded",
        targetType: "billing_account",
        targetId: account.id,
        metadataJson: JSON.stringify({ plan: selected.plan, sandbox: true })
      }
    })
  ]);

  return { ok: true as const, data: await getBillingData(orgId) };
}

export async function getBillingUsage(orgId: string) {
  const data = await getBillingData(orgId);
  return data.usage;
}

async function requireBillingAdmin(orgId: string) {
  const context = await requireOrgMember(orgId);
  if (!["owner", "admin", "billing"].includes(context.membership.role)) {
    throw new ForbiddenError("Billing admin access required");
  }
  return context;
}

async function ensureBillingAccount(orgId: string) {
  const existing = await prisma.billingAccount.findUnique({ where: { organizationId: orgId } });
  if (existing) return existing;

  return prisma.billingAccount.create({
    data: {
      organizationId: orgId,
      plan: "trial",
      status: "trialing",
      includedUsageCents: 1500,
      baseMonthlyCents: 0,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
}

async function ensureUsageRecords(orgId: string) {
  const existing = await prisma.usageRecord.count({ where: { organizationId: orgId } });
  if (existing > 0) return;

  const now = new Date();
  await prisma.usageRecord.createMany({
    data: usageCategories.map((category, index) => ({
      organizationId: orgId,
      category: category.category,
      quantity: category.defaultQuantity,
      unit: category.unit,
      costCents: category.defaultCostCents,
      sourceId: `sandbox-${category.category}`,
      occurredAt: new Date(now.getTime() - index * 6 * 60 * 60 * 1000)
    }))
  });
}

export function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
