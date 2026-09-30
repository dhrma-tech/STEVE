import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  getEffectivePolicy,
  getOrgPolicy,
  isOrgPaused,
  PolicyValidationError,
  resolveRunLimits,
  updatePolicy
} from "@/lib/agents/policy/store";
import { ORG, resetDb, seedAgent } from "@/lib/agents/testing/test-db";

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());

describe("policy store", () => {
  it("returns an empty policy when nothing is set", async () => {
    expect(await getOrgPolicy(ORG)).toEqual({
      agentsPaused: false, perRunBudgetCents: null, dailyBudgetCents: null, autoApprove: [], alwaysAsk: []
    });
  });

  it("creates then updates the org policy in place", async () => {
    await updatePolicy(ORG, { perRunBudgetCents: 50 });
    await updatePolicy(ORG, { dailyBudgetCents: 500, alwaysAsk: ["delete_file"] });
    expect(await prisma.policy.count()).toBe(1);
    expect(await getOrgPolicy(ORG)).toMatchObject({ perRunBudgetCents: 50, dailyBudgetCents: 500, alwaysAsk: ["delete_file"] });
  });

  it("merges org and agent rules, and lets the agent budget override the org's", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Eng", departmentSlug: "engineering" });
    await updatePolicy(ORG, { alwaysAsk: ["delete_file"], perRunBudgetCents: 100 });
    await updatePolicy(ORG, { autoApprove: ["github_push_file"], perRunBudgetCents: 25 }, agent.id);

    const effective = await getEffectivePolicy(ORG, agent.id);
    expect([...effective.policy.alwaysAsk]).toEqual(["delete_file"]);
    expect([...effective.policy.autoApprove]).toEqual(["github_push_file"]);
    expect(effective.perRunBudgetCents).toBe(25);
  });

  it("rejects pre-approving communication or spend tools", async () => {
    await expect(updatePolicy(ORG, { autoApprove: ["email_send"] })).rejects.toThrow(PolicyValidationError);
    await expect(updatePolicy(ORG, { autoApprove: ["stripe_create_product"] })).rejects.toThrow(/always needs a fresh approval/);
    expect(await prisma.policy.count()).toBe(0);
  });

  it("rejects unknown tools and pointless pre-approval of low-risk tools", async () => {
    await expect(updatePolicy(ORG, { autoApprove: ["nope"] })).rejects.toThrow(/Unknown tool/);
    await expect(updatePolicy(ORG, { autoApprove: ["web_search"] })).rejects.toThrow(/low risk/);
    await expect(updatePolicy(ORG, { alwaysAsk: ["nope"] })).rejects.toThrow(/Unknown tool/);
  });

  it("allows always-asking any known tool and pre-approving third-party writes", async () => {
    await updatePolicy(ORG, { alwaysAsk: ["email_send", "web_search"], autoApprove: ["github_push_file", "delete_file"] });
    expect(await getOrgPolicy(ORG)).toMatchObject({
      alwaysAsk: ["email_send", "web_search"], autoApprove: ["github_push_file", "delete_file"]
    });
  });

  it("keeps one org row and one row per agent, even under concurrent updates of different rows", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Eng", departmentSlug: "engineering" });
    await Promise.all([updatePolicy(ORG, { perRunBudgetCents: 10 }), updatePolicy(ORG, { perRunBudgetCents: 20 }, agent.id)]);
    expect(await prisma.policy.count({ where: { agentId: null } })).toBe(1);
    expect(await prisma.policy.count({ where: { agentId: agent.id } })).toBe(1);
  });
});

describe("pause and run limits", () => {
  it("reports the org as paused", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Eng", departmentSlug: "engineering" });
    expect(await isOrgPaused(ORG, agent.id)).toBe(false);
    await updatePolicy(ORG, { agentsPaused: true });
    expect(await isOrgPaused(ORG, agent.id)).toBe(true);
  });

  it("uses the environment defaults, overridden by the policy's per-run budget", async () => {
    const agent = await seedAgent({ slug: "eng", name: "Eng", departmentSlug: "engineering" });
    vi.stubEnv("AGENT_RUN_BUDGET_CENTS", "300");
    expect((await resolveRunLimits(ORG, agent.id)).budgetCents).toBe(300);
    await updatePolicy(ORG, { perRunBudgetCents: 40 });
    expect(await resolveRunLimits(ORG, agent.id)).toMatchObject({ budgetCents: 40, maxDepth: 3 });
  });
});
