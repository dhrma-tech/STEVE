import type { PlanId } from "@/data/pricing";

export type PricingInput = {
  plan: PlanId;
  businessSize: number;
};

export type PricingBreakdown = {
  plan: PlanId;
  businessSize: number;
  basePlanCost: number;
  includedUsage: number;
  numberOfAgents: number;
  tokenCost: number;
  computeCost: number;
  databaseCost: number;
  customerSupport: number;
  adSpend: number;
  dataPurchasing: number;
  usageSubtotal: number;
  totalMonthlyCost: number;
};

const planBaseCost: Record<PlanId, number> = {
  trial: 0,
  pro: 20,
  team: 50
};

const includedUsage: Record<PlanId, number> = {
  trial: 15,
  pro: 0,
  team: 0
};

export function clampBusinessSize(value: number) {
  if (Number.isNaN(value)) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.round(value)));
}

export function calculatePricing({ plan, businessSize }: PricingInput): PricingBreakdown {
  const size = clampBusinessSize(businessSize);
  const numberOfAgents = Math.min(8, Math.max(2, Math.ceil(size * 0.8)));
  const tokenCost = roundMoney(numberOfAgents * size * 2.35);
  const computeCost = roundMoney(4 + size * 1.8);
  const databaseCost = roundMoney(2 + size * 0.9);
  const customerSupport = roundMoney(plan === "trial" ? size * 0.6 : size * 1.25);
  const adSpend = roundMoney(plan === "trial" ? 0 : size * 3.5);
  const dataPurchasing = roundMoney(size * 1.15);
  const grossUsage = roundMoney(tokenCost + computeCost + databaseCost + customerSupport + adSpend + dataPurchasing);
  const usageSubtotal = Math.max(0, roundMoney(grossUsage - includedUsage[plan]));
  const totalMonthlyCost = roundMoney(planBaseCost[plan] + usageSubtotal);

  return {
    plan,
    businessSize: size,
    basePlanCost: planBaseCost[plan],
    includedUsage: includedUsage[plan],
    numberOfAgents,
    tokenCost,
    computeCost,
    databaseCost,
    customerSupport,
    adSpend,
    dataPurchasing,
    usageSubtotal,
    totalMonthlyCost
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

