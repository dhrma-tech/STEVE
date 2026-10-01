import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel } from "@/lib/agents/testing/scripted-anthropic";
import { ORG, resetDb, seedAgent, USER } from "@/lib/agents/testing/test-db";
import { launchRoadmapItem } from "@/lib/roadmap/data";
import { cancelPlan } from "./store";

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);
// The roadmap API checks the signed-in member; here the reviewer user is always signed in.
vi.mock("@/lib/auth/session", () => {
  const owner = async () => ({ user: { id: USER }, membership: { role: "owner" } });
  return { requireOrgMember: owner, requireOrgWriter: owner };
});

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("launching a roadmap item", () => {
  it("creates a plan, blocks a second launch while it is live, and allows a relaunch after it stops", async () => {
    await seedAgent({ slug: "ops", name: "Operations Agent", departmentSlug: "operations" });
    const eng = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering", isDefault: true });

    const first = await launchRoadmapItem({ orgId: ORG, itemId: "prepare_repository" });
    expect(first.kind).toBe("plan_created");
    if (first.kind !== "plan_created") return;
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: first.planId } });
    expect(plan.roadmapItemId).toBe(first.item.id);
    expect(plan.goal).toBe("Prepare repository");

    // The plan is still drafting: launching again points at it instead of starting another.
    const second = await launchRoadmapItem({ orgId: ORG, itemId: "prepare_repository" });
    expect(second).toMatchObject({ kind: "existing_plan", planId: first.planId });

    // Once the plan has stopped, its tasks no longer hold the item: the founder can try again.
    await cancelPlan({ orgId: ORG, planId: first.planId });
    const third = await launchRoadmapItem({ orgId: ORG, itemId: "prepare_repository" });
    expect(third.kind).toBe("plan_created");

    // Choosing an agent skips planning and runs it directly.
    await prisma.plan.updateMany({ where: { organizationId: ORG }, data: { status: "cancelled" } });
    const direct = await launchRoadmapItem({ orgId: ORG, itemId: "prepare_repository", agentId: eng.id });
    expect(direct.kind).toBe("task_created");
    expect(direct.kind === "task_created" && direct.sessionId).toBeTruthy();
  });
});
