import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, seedTask } from "@/lib/agents/testing/test-db";
import { startAgentRun } from "@/lib/agents/run-service";
import { groupedSearch } from "@/lib/search/grouped-search";
import { orgScope, remember } from "@/lib/memory/store";
import { chunkText, searchTerms } from "./chunk";
import { syncKnowledge } from "./index";
import { searchKnowledge } from "./search";

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);

const call = (name: string, input: Record<string, unknown> = {}): ScriptedTurn => ({ toolCalls: [{ name, input }] });

async function file(name: string, text: string) {
  return prisma.file.create({
    data: {
      organizationId: ORG,
      name,
      storageKey: `orgs/${ORG}/${name}`,
      visibility: "organization",
      metadataJson: JSON.stringify({ previewText: text })
    }
  });
}

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("chunkText", () => {
  it("keeps short text whole and splits long text on paragraphs", () => {
    expect(chunkText("  hello  ")).toEqual(["hello"]);
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ${"word ".repeat(80)}`).join("\n\n");
    const chunks = chunkText(paragraphs, 1200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1200)).toBe(true);
    expect(chunks.join(" ")).toContain("Paragraph 5");
  });

  it("cuts an overlong paragraph with overlap", () => {
    const chunks = chunkText("x".repeat(3000), 1200);
    expect(chunks.length).toBe(3);
    expect(chunks[0]!.length).toBe(1200);
  });

  it("makes safe OR terms", () => {
    expect(searchTerms("What's our refund-policy?! a b")).toEqual(["what", "our", "refund", "policy"]);
  });
});

describe("searchKnowledge", () => {
  it("finds passages inside files, including the business plan, and forgets archived files", async () => {
    await file("Business Plan.md", "# Plan\n\nWe sell scheduling software to dental clinics in Portugal.\n\nPricing is $49 per clinic per month.");
    const pricing = await file("pricing-notes.md", "Annual plans get two months free. Refunds are possible within 30 days.");

    const hits = await searchKnowledge({ orgId: ORG, query: "dental clinics" });
    expect(hits[0]).toMatchObject({ kind: "file", title: "Business Plan.md" });
    expect(hits[0]!.snippet).toContain("**dental**");

    // A question in plain words still finds the passage (any-word fallback).
    const question = await searchKnowledge({ orgId: ORG, query: "how long do customers have for refunds" });
    expect(question.map((h) => h.title)).toContain("pricing-notes.md");

    await prisma.file.update({ where: { id: pricing.id }, data: { archivedAt: new Date() } });
    expect((await searchKnowledge({ orgId: ORG, query: "refunds" })).map((h) => h.title)).not.toContain("pricing-notes.md");
  });

  it("matches words inside file names (Plan.md is the word plan)", async () => {
    await file("Business Plan.md", "");
    await file("go-to-market_notes.txt", "");
    expect((await searchKnowledge({ orgId: ORG, query: "plan" })).map((h) => h.title)).toEqual(["Business Plan.md"]);
    expect((await searchKnowledge({ orgId: ORG, query: "market notes" })).map((h) => h.title)).toEqual(["go-to-market_notes.txt"]);
  });

  it("re-indexes a file when it changes", async () => {
    const doc = await file("faq.md", "Our office is in Lisbon.");
    expect(await searchKnowledge({ orgId: ORG, query: "Lisbon" })).toHaveLength(1);
    await prisma.file.update({ where: { id: doc.id }, data: { metadataJson: JSON.stringify({ previewText: "Our office moved to Porto." }) } });
    expect(await searchKnowledge({ orgId: ORG, query: "Lisbon" })).toHaveLength(0);
    expect(await searchKnowledge({ orgId: ORG, query: "Porto" })).toHaveLength(1);
  });

  it("indexes chat with the founder but not agent outputs twice", async () => {
    const thread = await prisma.chatThread.create({ data: { organizationId: ORG, kind: "cofounder", title: "Cofounder chat" } });
    await prisma.chatMessage.create({ data: { organizationId: ORG, threadId: thread.id, senderType: "user", body: "Let's focus on European customers before the US launch." } });
    await prisma.chatMessage.create({
      data: { organizationId: ORG, threadId: thread.id, senderType: "agent", body: "Agent output about European customers and stuff.", metadataJson: JSON.stringify({ kind: "agent_output" }) }
    });
    const hits = await searchKnowledge({ orgId: ORG, query: "European customers" });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: "chat", title: "Cofounder chat (Founder)" });
  });

  it("makes what a run produced searchable, and lets agents search with search_knowledge", async () => {
    const mkt = await seedAgent({ slug: "mkt", name: "Marketing Agent", departmentSlug: "marketing" });
    const sales = await seedAgent({ slug: "sales", name: "Sales Agent", departmentSlug: "sales" });
    await remember({ orgId: ORG, scope: orgScope, key: "competitor", value: "Our main competitor is Calendly.", source: "founder" });

    scriptedModel.route("Marketing Agent", [
      call("finish_run", { status: "done", summary: "Competitor teardown: Calendly lacks clinic-specific reminders.", artifacts: [{ type: "file", ref: "teardown.md" }] })
    ]);
    const task = await seedTask({ agentId: mkt.id, departmentId: mkt.departmentId, title: "Competitor teardown" });
    await startAgentRun({ orgId: ORG, taskId: task.id, agentId: mkt.id });
    await drainAll();
    expect(await prisma.knowledgeChunk.count({ where: { sourceType: "run_summary" } })).toBe(1);

    scriptedModel.route("Sales Agent", [call("search_knowledge", { query: "what does Calendly lack" }), { text: "ok" }]);
    const salesTask = await seedTask({ agentId: sales.id, departmentId: sales.departmentId, title: "Battle card" });
    await startAgentRun({ orgId: ORG, taskId: salesTask.id, agentId: sales.id });
    await drainAll();
    const toolOutput = JSON.stringify(scriptedModel.calls.at(-1)!.messages);
    expect(toolOutput).toContain("[Past work] Marketing Agent: Competitor teardown");
    expect(toolOutput).toContain("clinic-specific reminders");
    expect(toolOutput).toContain("[Memory] Memory: competitor (org)");
  });

  it("only shows an agent the memory scopes it may see", async () => {
    await remember({ orgId: ORG, scope: "department:finance", key: "runway", value: "Runway is 14 months.", source: "founder" });
    expect(await searchKnowledge({ orgId: ORG, query: "runway months", memoryScopes: [orgScope, "department:sales"] })).toHaveLength(0);
    expect(await searchKnowledge({ orgId: ORG, query: "runway months", memoryScopes: null })).toHaveLength(1);
  });

  it("does nothing when the index is current", async () => {
    await file("a.md", "alpha beta gamma");
    await syncKnowledge(ORG, { force: true });
    expect(await syncKnowledge(ORG)).toEqual({ files: 0, chat: 0, runs: 0 });
  });
});

describe("command palette", () => {
  it("adds a Knowledge group with passages from inside documents", async () => {
    await file("Business Plan.md", "We sell scheduling software to dental clinics.");
    const groups = await groupedSearch({ orgId: ORG, q: "dental", types: ["knowledge", "files"] });
    const knowledge = groups.find((g) => g.type === "knowledge")!;
    expect(knowledge.items[0]).toMatchObject({ title: "Business Plan.md", status: "file" });
    expect(knowledge.items[0]!.subtitle).toContain("dental clinics");
    expect(knowledge.items[0]!.subtitle).not.toContain("**");
    // The plain file-name search does not see inside the file.
    expect(groups.find((g) => g.type === "files")!.items).toHaveLength(0);
  });
});
