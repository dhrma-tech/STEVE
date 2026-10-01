import { describe, expect, it } from "vitest";
import { buildToolset } from "@/lib/agents/tools/registry";
import { classifyToolCall, isClassified, isReadOnlySql, summarizeToolCall, TOOL_RISK } from "@/lib/agents/policy/risk";

const ALL_SKILLS = [
  "github-repository",
  "vercel-preview",
  "postiz-social",
  "email-outbound",
  "stripe-billing",
  "apify-scraping",
  "monitoring-ops",
  "supabase-database",
  "support-inbox"
];

describe("tool risk table", () => {
  // Every tool any kind of run can be given (planning runs get propose_plan, which task runs do not).
  const registered = [
    ...new Set(["task", "plan", "review", "consult"].flatMap((kind) => buildToolset(ALL_SKILLS, { kind }).map((tool) => tool.definition.name)))
  ];

  it("classifies every tool an agent can be given", () => {
    const unclassified = registered.filter((name) => !isClassified(name));
    expect(unclassified).toEqual([]);
  });

  it("has no entries for tools that no longer exist", () => {
    const stale = Object.keys(TOOL_RISK).filter((name) => !registered.includes(name));
    expect(stale).toEqual([]);
  });

  it("puts everything that reaches people or spends money in the never-pre-approved tiers", () => {
    for (const name of ["email_send", "support_reply_to_thread", "postiz_schedule_post"]) {
      expect(classifyToolCall(name)).toBe("external_comms");
    }
    for (const name of ["stripe_create_product", "stripe_create_price", "stripe_create_payment_link", "vercel_trigger_deploy"]) {
      expect(classifyToolCall(name)).toBe("spend");
    }
  });

  it("treats an unknown tool as an external write, so it asks instead of running silently", () => {
    expect(classifyToolCall("brand_new_tool")).toBe("external_write");
    expect(isClassified("brand_new_tool")).toBe(false);
  });
});

describe("supabase_run_query classification", () => {
  const risk = (sql: string) => classifyToolCall("supabase_run_query", { sql });

  it("treats a single SELECT as a read", () => {
    expect(risk("SELECT id, email FROM users LIMIT 10")).toBe("read");
    expect(risk("select count(*) from orders;")).toBe("read");
    expect(risk("with recent as (select * from orders) select * from recent")).toBe("read");
    expect(risk("EXPLAIN select 1")).toBe("read");
  });

  it("treats anything that can change data, or several statements, as a write", () => {
    expect(risk("insert into users(email) values ('a@b.c')")).toBe("external_write");
    expect(risk("update users set name = 'x'")).toBe("external_write");
    expect(risk("select 1; drop table users")).toBe("external_write");
    expect(risk("with gone as (delete from users returning *) select * from gone")).toBe("external_write");
    expect(risk("")).toBe("external_write");
    expect(classifyToolCall("supabase_run_query", {})).toBe("external_write");
  });

  it("exposes the read-only check directly", () => {
    expect(isReadOnlySql("select 1")).toBe(true);
    expect(isReadOnlySql("drop table x")).toBe(false);
  });
});

describe("summarizeToolCall", () => {
  it("describes a send in plain words without including the body", () => {
    const summary = summarizeToolCall("email_send", { to: "a@b.co", subject: "Hello", body: "SECRET BODY ".repeat(50) });
    expect(summary).toContain("a@b.co");
    expect(summary).toContain("Hello");
    expect(summary).not.toContain("SECRET BODY");
  });

  it("falls back to a short generic form for other tools", () => {
    expect(summarizeToolCall("something_else", { a: 1 })).toContain("something_else");
  });
});
