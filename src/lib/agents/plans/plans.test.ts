import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, USER } from "@/lib/agents/testing/test-db";
import { Worker } from "@/lib/agents/engine/worker";
import { getRunBySession } from "@/lib/agents/engine/run-store";
import { loadDirectory } from "@/lib/agents/directory";
import { approvePlan, cancelPlan, createGoalPlan, editPlan, getPlan } from "./store";
import { ORCHESTRATOR_SLUG, REVIEWER_SLUG } from "./system-agents";

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);

const call = (name: string, input: Record<string, unknown> = {}, extra: Partial<ScriptedTurn> = {}): ScriptedTurn => ({
  toolCalls: [{ name, input }],
  ...extra
});
const finish = (summary: string, extra: Record<string, unknown> = {}, turn: Partial<ScriptedTurn> = {}) =>
  call("finish_run", { status: "done", summary, ...extra }, turn);
const fail = (summary: string) => call("finish_run", { status: "failed", summary });
const propose = (summary: string, nodes: Array<Record<string, unknown>>) => call("propose_plan", { summary, nodes });

/** How long a scripted call is held so parallel steps overlap, with room for a busy machine (see delegation-protocol.test). */
const OVERLAP_MS = 1500;

const CHIEF = "Chief of Staff";
const REVIEWER = "Reviewer";

async function team() {
  const ops = await seedAgent({ slug: "ops", name: "Operations Agent", departmentSlug: "operations" });
  const design = await seedAgent({ slug: "design", name: "Design Agent", departmentSlug: "design" });
  const eng = await seedAgent({ slug: "eng", name: "Engineering Agent", departmentSlug: "engineering" });
  const mkt = await seedAgent({ slug: "mkt", name: "Marketing Agent", departmentSlug: "marketing" });
  const sales = await seedAgent({ slug: "sales", name: "Sales Agent", departmentSlug: "sales", skillKeys: ["email-outbound"] });
  return { ops, design, eng, mkt, sales };
}

const planRow = (planId: string) => prisma.plan.findUniqueOrThrow({ where: { id: planId }, include: { nodes: true } });
const nodeByKey = async (planId: string, key: string) => prisma.planNode.findUniqueOrThrow({ where: { planId_key: { planId, key } } });
const runsOf = (planId: string, kind: string) => prisma.run.findMany({ where: { planId, kind }, orderBy: { createdAt: "asc" } });

/** Run the queue until it is quiet (one job at a time, deterministic order). */
const settle = () => drainAll();

let workers: Worker[] = [];
beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(async () => {
  await Promise.all(workers.map((w) => w.stop()));
  workers = [];
  vi.unstubAllEnvs();
});

const LAUNCH_NODES = [
  { key: "brand", title: "Pick the visual direction", agentSlug: "design", estimatedCostCents: 30, estimatedMinutes: 10 },
  {
    key: "copy",
    title: "Write the landing page copy",
    agentSlug: "mkt",
    review: true,
    acceptanceCriteria: ["Headline under 10 words", "One clear call to action"],
    estimatedMinutes: 15
  },
  {
    key: "build",
    title: "Build the landing page",
    agentSlug: "eng",
    dependsOn: ["brand", "copy"],
    review: true,
    acceptanceCriteria: ["Preview deployment exists"],
    estimatedMinutes: 30
  },
  { key: "deploy", title: "Deploy to production", agentSlug: "eng", dependsOn: ["build"], riskNotes: "Production deploy asks for approval" },
  { key: "announce", title: "Announce the launch", agentSlug: "mkt", dependsOn: ["deploy"] },
  { key: "outreach", title: "Email early prospects", agentSlug: "sales", dependsOn: ["deploy"] }
];

describe("scenario: launch our landing page and announce it", () => {
  it("plans across departments, waits for review, runs in dependency order, replans after a failure and reports", async () => {
    await team();
    scriptedModel.route(CHIEF, [
      propose("Brand and copy in parallel, then build, deploy and announce.", LAUNCH_NODES),
      propose("Retry the deploy with the fixed build config.", [
        ...LAUNCH_NODES.filter((n) => n.key !== "deploy"),
        { key: "deploy", title: "Deploy to production", agentSlug: "eng", dependsOn: ["build"], description: "Use the fixed build config." }
      ]),
      { text: "The landing page is live and announced. Outreach drafts are ready for your approval." }
    ]);
    scriptedModel.route("Design Agent", [finish("Visual direction chosen.", {}, { delayMs: OVERLAP_MS })]);
    scriptedModel.route("Marketing Agent", [
      finish("Copy written.", { artifacts: [{ type: "file", ref: "landing-copy.md" }] }, { delayMs: OVERLAP_MS }),
      finish("Launch announced.", { artifacts: [{ type: "post", ref: "post_1" }] })
    ]);
    scriptedModel.route("Engineering Agent", [
      finish("Page built.", { artifacts: [{ type: "deployment", ref: "https://preview.example.com" }] }),
      fail("The production build config is broken."),
      finish("Deployed to production.", { artifacts: [{ type: "deployment", ref: "https://example.com" }] })
    ]);
    scriptedModel.route("Sales Agent", [finish("Outreach drafts ready.")]);
    scriptedModel.route(REVIEWER, [finish("Copy meets both criteria."), finish("Preview checked.")]);

    // ── Goal → proposed plan ──
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Launch our landing page and announce it" });
    await settle();

    const proposed = (await getPlan(ORG, plan.id))!;
    expect(proposed.status).toBe("proposed");
    expect(proposed.nodes).toHaveLength(6);
    expect(proposed.departments.length).toBeGreaterThanOrEqual(3);
    expect(proposed.estimatedMinutes).toBe(15 + 30 + 10 + 10); // copy -> build -> deploy -> announce
    expect(proposed.nodes.find((n) => n.key === "deploy")?.riskHotspots).toContain("Production deploy asks for approval");
    expect(proposed.nodes.find((n) => n.key === "outreach")?.riskHotspots).toContain("Can contact people or publish (asks you first)");
    // Nothing runs before the founder approves.
    expect(await runsOf(plan.id, "plan_node")).toHaveLength(0);
    // The Chief of Staff saw the team, without itself or the Reviewer in it.
    const planningSystem = scriptedModel.calls[0]!.system;
    expect(planningSystem).toContain("`eng`");
    expect(planningSystem).not.toContain("`reviewer`");
    expect(scriptedModel.calls[0]!.toolNames).toContain("propose_plan");
    expect(scriptedModel.calls[0]!.toolNames).not.toContain("delegate_agent");

    // ── Approve → execute ──
    expect((await approvePlan({ orgId: ORG, planId: plan.id, userId: USER })).kind).toBe("ok");
    const worker = new Worker({ id: "plan-scenario", concurrency: 4, pollMs: 20, sweepMs: 60_000 });
    workers.push(worker);
    worker.start();
    await vi.waitFor(async () => expect((await planRow(plan.id)).finishedAt).toBeTruthy(), { timeout: 30_000, interval: 100 });

    const done = await planRow(plan.id);
    expect(done.errorMessage ?? "").toBe("");
    expect(done.status).toBe("completed");
    expect(done.replanCount).toBe(1);
    expect(done.version).toBe(2);
    expect(done.reportText).toContain("The landing page is live");

    // Brand and copy ran at the same time.
    expect(scriptedModel.maxInFlight).toBeGreaterThanOrEqual(2);

    // Every step started only after the steps it depends on had finished.
    const byKey = new Map(done.nodes.map((n) => [n.key, n]));
    for (const node of done.nodes) {
      expect(node.status).toBe("done");
      for (const dep of JSON.parse(node.dependsOnJson) as string[]) {
        expect(node.startedAt!.getTime()).toBeGreaterThanOrEqual(byKey.get(dep)!.finishedAt!.getTime());
      }
    }

    // The deploy failed once, the Chief of Staff replanned, and the retry got the new brief.
    expect((await runsOf(plan.id, "plan_node")).length).toBe(7);
    const deployRuns = (await runsOf(plan.id, "plan_node")).filter((r) => r.planNodeId === byKey.get("deploy")!.id);
    expect(deployRuns.map((r) => r.status)).toEqual(["completed", "completed"]);
    expect(deployRuns[1]!.requestText).toContain("Use the fixed build config.");
    expect(deployRuns[1]!.requestText).toContain("Feedback on the previous attempt");
    const replanCall = scriptedModel.calls.filter((c) => c.system.startsWith(`You are ${CHIEF},`))[1]!;
    expect(JSON.stringify(replanCall.messages)).toContain("The production build config is broken.");
    expect(replanCall.system).toContain("How to replan");

    // Later steps got the earlier steps' results in their brief.
    const buildRun = (await runsOf(plan.id, "plan_node")).find((r) => r.planNodeId === byKey.get("build")!.id)!;
    expect(buildRun.requestText).toContain("Copy written.");
    expect(buildRun.requestText).toContain("file: landing-copy.md");

    // The Reviewer checked the two steps that asked for it.
    expect(await runsOf(plan.id, "review")).toHaveLength(2);
    expect(JSON.parse(byKey.get("copy")!.reviewJson!)).toMatchObject({ verdict: "pass" });
    expect(JSON.parse(byKey.get("build")!.reviewJson!)).toMatchObject({ verdict: "pass" });
    expect(byKey.get("brand")!.reviewJson).toBeNull();

    // Steps are visible tasks; reviews are not. The plan's own task is complete.
    const tasks = await prisma.task.findMany({ where: { id: { in: done.nodes.map((n) => n.taskId!) } } });
    expect(tasks.every((t) => t.status === "completed" && t.archivedAt === null)).toBe(true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: done.taskId! } })).status).toBe("completed");
    expect(await prisma.task.count({ where: { type: "agent_review", archivedAt: null } })).toBe(0);

    const report = (await getPlan(ORG, plan.id))!;
    expect(report.costCents).toBeGreaterThan(0);
    expect(report.reportSessionId).toBeTruthy();
    // Room for a busy machine: the whole plan (15 runs) waits up to 30 s above.
  }, 60_000);
});

describe("plan review", () => {
  const THREE = [
    { key: "research", title: "Research competitors", agentSlug: "mkt" },
    { key: "pricing", title: "Draft pricing", agentSlug: "ops", dependsOn: ["research"] },
    { key: "page", title: "Pricing page", agentSlug: "eng", dependsOn: ["pricing", "research"] }
  ];

  it("lets the founder remove and reassign steps before approving", async () => {
    const { design } = await team();
    scriptedModel.route(CHIEF, [propose("Research, price, publish.", THREE), { text: "Report." }]);
    scriptedModel.route("Marketing Agent", [finish("Research done.")]);
    scriptedModel.route("Design Agent", [finish("Page designed.")]);

    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Publish pricing" });
    await settle();
    const proposed = (await getPlan(ORG, plan.id))!;
    const id = (key: string) => proposed.nodes.find((n) => n.key === key)!.id;

    // Removing "pricing" also drops it from the page's dependencies; the page goes to Design instead.
    const edited = await editPlan({ orgId: ORG, planId: plan.id, nodes: [{ id: id("pricing"), remove: true }, { id: id("page"), agentId: design.id, title: "Design the pricing page" }] });
    expect(edited.kind).toBe("ok");
    const after = (await getPlan(ORG, plan.id))!;
    expect(after.nodes.find((n) => n.key === "pricing")!.status).toBe("skipped");
    expect(after.nodes.find((n) => n.key === "page")).toMatchObject({ dependsOn: ["research"], title: "Design the pricing page", agent: { slug: "design" } });

    expect((await approvePlan({ orgId: ORG, planId: plan.id, userId: USER })).kind).toBe("ok");
    await settle();
    const finished = await planRow(plan.id);
    expect(finished.status).toBe("completed");
    const page = await nodeByKey(plan.id, "page");
    expect((await prisma.run.findFirstOrThrow({ where: { id: page.runId! } })).agentId).toBe(design.id);
    // The skipped step never ran.
    expect(await prisma.run.count({ where: { planNodeId: (await nodeByKey(plan.id, "pricing")).id } })).toBe(0);
  });

  it("refuses edits that would loop, assign a system agent or leave nothing", async () => {
    await team();
    scriptedModel.route(CHIEF, [propose("x", THREE)]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Publish pricing" });
    await settle();
    const proposed = (await getPlan(ORG, plan.id))!;
    const id = (key: string) => proposed.nodes.find((n) => n.key === key)!.id;
    const chief = await prisma.agent.findFirstOrThrow({ where: { slug: ORCHESTRATOR_SLUG } });

    expect(await editPlan({ orgId: ORG, planId: plan.id, nodes: [{ id: id("research"), dependsOn: ["page"] }] })).toMatchObject({ kind: "invalid" });
    expect(await editPlan({ orgId: ORG, planId: plan.id, nodes: [{ id: id("research"), agentId: chief.id }] })).toMatchObject({ kind: "invalid" });
    expect(
      await editPlan({ orgId: ORG, planId: plan.id, nodes: proposed.nodes.map((n) => ({ id: n.id, remove: true })) })
    ).toMatchObject({ kind: "invalid" });
    // Approving twice, or editing once running, is a conflict.
    expect((await approvePlan({ orgId: ORG, planId: plan.id, userId: USER })).kind).toBe("ok");
    expect((await approvePlan({ orgId: ORG, planId: plan.id, userId: USER })).kind).toBe("conflict");
    expect((await editPlan({ orgId: ORG, planId: plan.id, nodes: [] })).kind).toBe("conflict");
  });

  it("starts at once when a manager auto-approves within the daily budget, and waits when it does not fit", async () => {
    await team();
    scriptedModel.route(CHIEF, [propose("One step.", [{ key: "copy", title: "Copy", agentSlug: "mkt", estimatedCostCents: 50 }]), { text: "Report." }]);
    scriptedModel.route("Marketing Agent", [finish("Copy written.")]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Write copy", autoApprove: true });
    await settle();
    expect((await planRow(plan.id)).status).toBe("completed");
    expect((await planRow(plan.id)).approvedAt).toBeTruthy();

    await prisma.policy.create({ data: { organizationId: ORG, dailyBudgetCents: 10, autoApproveJson: "[]", alwaysAskJson: "[]" } });
    scriptedModel.route(CHIEF, [propose("One step.", [{ key: "copy", title: "Copy", agentSlug: "mkt", estimatedCostCents: 50 }])]);
    const second = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Write more copy", autoApprove: true });
    await settle();
    expect((await planRow(second.plan.id)).status).toBe("proposed");
  });
});

describe("planning", () => {
  it("sends an invalid plan back to the Chief of Staff to fix", async () => {
    await team();
    scriptedModel.route(CHIEF, [
      propose("Bad", [{ key: "a", title: "A", agentSlug: "nobody", dependsOn: ["ghost"] }]),
      propose("Good", [{ key: "a", title: "A", agentSlug: "mkt" }])
    ]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Do A" });
    await settle();
    expect((await planRow(plan.id)).status).toBe("proposed");
    const retry = JSON.stringify(scriptedModel.calls[1]!.messages);
    expect(retry).toContain('unknown step \\"ghost\\"');
  });

  it("refuses a system agent as a step owner", async () => {
    await team();
    scriptedModel.route(CHIEF, [
      propose("x", [{ key: "a", title: "A", agentSlug: REVIEWER_SLUG }]),
      propose("x", [{ key: "a", title: "A", agentSlug: "mkt" }])
    ]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Do A" });
    await settle();
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toContain("cannot own a step");
    expect((await planRow(plan.id)).status).toBe("proposed");
  });

  it("fails the plan when the Chief of Staff never proposes one", async () => {
    await team();
    scriptedModel.route(CHIEF, [{ text: "I think we should launch." }, { text: "Still thinking." }]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Launch" });
    await settle();
    const row = await planRow(plan.id);
    expect(row.status).toBe("failed");
    expect(row.errorMessage).toContain("without proposing a plan");
    // It was reminded once before giving up.
    expect(JSON.stringify(scriptedModel.calls[1]!.messages)).toContain("You ended without calling propose_plan");
  });

  it("keeps the Chief of Staff and the Reviewer out of the team directory and out of reach of delegation", async () => {
    await team();
    scriptedModel.route(CHIEF, [propose("x", [{ key: "a", title: "A", agentSlug: "mkt" }])]);
    await createGoalPlan({ orgId: ORG, userId: USER, goal: "Do A" });
    const slugs = (await loadDirectory(ORG)).map((entry) => entry.slug);
    expect(slugs).toContain("mkt");
    expect(slugs).not.toContain(ORCHESTRATOR_SLUG);
    expect(slugs).not.toContain(REVIEWER_SLUG);
  });
});

describe("review and retries", () => {
  it("gives a rejected step one more attempt with the Reviewer's feedback", async () => {
    await team();
    scriptedModel.route(CHIEF, [
      propose("Write the email.", [{ key: "email", title: "Welcome email", agentSlug: "mkt", review: true, acceptanceCriteria: ["Mentions the free trial"] }]),
      { text: "Done." }
    ]);
    scriptedModel.route("Marketing Agent", [finish("Draft one."), finish("Draft two, with the trial.")]);
    scriptedModel.route(REVIEWER, [
      call("finish_run", { status: "failed", summary: "The free trial is not mentioned.", findings: ["No mention of the 14-day trial"] }),
      finish("Mentions the trial.")
    ]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Welcome email" });
    await settle();
    await approvePlan({ orgId: ORG, planId: plan.id, userId: USER });
    await settle();

    const node = await nodeByKey(plan.id, "email");
    expect(node.status).toBe("done");
    expect(node.attempts).toBe(2);
    const runs = (await runsOf(plan.id, "plan_node")).filter((r) => r.planNodeId === node.id);
    expect(runs).toHaveLength(2);
    expect(runs[1]!.requestText).toContain("No mention of the 14-day trial");
    expect((await planRow(plan.id)).status).toBe("completed");
    // The Reviewer only had read-only tools and finish_run.
    const reviewerCall = scriptedModel.calls.find((c) => c.system.startsWith(`You are ${REVIEWER},`))!;
    expect(reviewerCall.toolNames).toContain("finish_run");
    expect(reviewerCall.toolNames).not.toContain("write_file");
    expect(reviewerCall.toolNames).not.toContain("delegate_agent");
  });

  it("stops after the replan limit and reports instead of looping", async () => {
    await team();
    const nodes = [{ key: "deploy", title: "Deploy", agentSlug: "eng" }];
    scriptedModel.route(CHIEF, [
      propose("Deploy.", nodes),
      propose("Try again.", nodes),
      propose("One last try.", nodes),
      { text: "We could not deploy. The build config needs your decision." }
    ]);
    scriptedModel.route("Engineering Agent", [fail("Broken."), fail("Still broken."), fail("Broken again.")]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Deploy" });
    await settle();
    await approvePlan({ orgId: ORG, planId: plan.id, userId: USER });
    await settle();

    const row = await planRow(plan.id);
    expect(row.status).toBe("failed");
    expect(row.replanCount).toBe(2);
    expect(row.errorMessage).toContain("Stopped after 2 replans");
    expect(row.reportText).toContain("could not deploy");
    expect(await runsOf(plan.id, "plan_node")).toHaveLength(3);
    expect(scriptedModel.calls.filter((c) => c.system.startsWith(`You are ${CHIEF},`))).toHaveLength(4);
  });

  it("hands the decision to the founder when replanning finds no way forward", async () => {
    await team();
    scriptedModel.route(CHIEF, [
      propose("Deploy.", [{ key: "deploy", title: "Deploy", agentSlug: "eng" }]),
      { text: "Only the founder can fix the credentials." },
      { text: "I cannot plan around missing credentials." },
      { text: "Report: blocked on credentials." }
    ]);
    scriptedModel.route("Engineering Agent", [call("finish_run", { status: "blocked", summary: "No Vercel token.", openQuestions: ["Can you add a token?"] })]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Deploy" });
    await settle();
    await approvePlan({ orgId: ORG, planId: plan.id, userId: USER });
    await settle();

    const row = await planRow(plan.id);
    expect(row.status).toBe("failed");
    expect(row.errorMessage).toContain("handed the decision to you");
    expect(row.reportText).toContain("blocked on credentials");
    const deploy = await nodeByKey(plan.id, "deploy");
    expect(deploy.feedback).toContain("Can you add a token?");
  });
});

describe("cancelling and the roadmap", () => {
  it("cancels the runs still working on a plan", async () => {
    await team();
    scriptedModel.route(CHIEF, [propose("Two steps.", [{ key: "a", title: "A", agentSlug: "mkt" }, { key: "b", title: "B", agentSlug: "design" }])]);
    const { plan } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "A and B" });
    await settle();
    await approvePlan({ orgId: ORG, planId: plan.id, userId: USER });
    // Start the steps (the plan job) without letting their runs go anywhere.
    const worker = new Worker({ id: "one", concurrency: 1 });
    await worker.runOnce();
    expect(await prisma.run.count({ where: { planId: plan.id, kind: "plan_node", status: "queued" } })).toBe(2);

    expect((await cancelPlan({ orgId: ORG, planId: plan.id })).kind).toBe("ok");
    const row = await planRow(plan.id);
    expect(row.status).toBe("cancelled");
    expect(row.nodes.every((n) => n.status === "skipped")).toBe(true);
    expect(await prisma.run.count({ where: { planId: plan.id, kind: "plan_node", status: "cancelled" } })).toBe(2);
    expect((await cancelPlan({ orgId: ORG, planId: plan.id })).kind).toBe("conflict");
    await settle(); // nothing left to do, and nothing restarts
    expect((await planRow(plan.id)).status).toBe("cancelled");
  });

  it("completes the roadmap item a plan was launched for", async () => {
    await team();
    const stage = await prisma.roadmapStage.create({ data: { organizationId: ORG, key: "launch", name: "Launch", sortOrder: 0 } });
    const item = await prisma.roadmapItem.create({
      data: { organizationId: ORG, stageId: stage.id, key: "landing_page", title: "Landing page", status: "available", workType: "agent", sortOrder: 0 }
    });
    scriptedModel.route(CHIEF, [propose("One step.", [{ key: "page", title: "Page", agentSlug: "eng" }]), { text: "Report." }]);
    scriptedModel.route("Engineering Agent", [finish("Page live.")]);

    const { plan, sessionId } = await createGoalPlan({ orgId: ORG, userId: USER, goal: "Landing page", roadmapItemId: item.id });
    expect((await getRunBySession(sessionId))?.kind).toBe("plan");
    await settle();
    await approvePlan({ orgId: ORG, planId: plan.id, userId: USER });
    await settle();

    expect((await planRow(plan.id)).status).toBe("completed");
    expect((await prisma.roadmapItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("complete");
    const stepTask = await prisma.task.findUniqueOrThrow({ where: { id: (await nodeByKey(plan.id, "page")).taskId! } });
    expect(stepTask.roadmapItemId).toBe(item.id);
  });
});
