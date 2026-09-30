import { describe, expect, it } from "vitest";
import { decide, type EffectivePolicy } from "@/lib/agents/policy/engine";
import type { PermissionMode } from "@/lib/agents/run-scope";

const policy = (over: Partial<{ autoApprove: string[]; alwaysAsk: string[] }> = {}): EffectivePolicy => ({
  autoApprove: new Set(over.autoApprove ?? []),
  alwaysAsk: new Set(over.alwaysAsk ?? [])
});

const run = (toolName: string, mode: PermissionMode, extra: Partial<Parameters<typeof decide>[0]> = {}) =>
  decide({ toolName, input: {}, mode, ...extra }).action;

describe("policy decisions by mode", () => {
  it("allows low-risk tools in every mode", () => {
    for (const mode of ["sandbox_only", "review_required", "trusted"] as const) {
      expect(run("web_search", mode)).toBe("allow");
      expect(run("write_file", mode)).toBe("allow");
      expect(run("delegate_agent", mode)).toBe("allow");
    }
  });

  it("review_required asks for anything with outside effects", () => {
    for (const tool of ["github_push_file", "delete_file", "email_send", "stripe_create_product", "postiz_create_post"]) {
      expect(run(tool, "review_required")).toBe("ask");
    }
  });

  it("trusted allows third-party writes but still asks for destructive, comms and spend", () => {
    expect(run("github_push_file", "trusted")).toBe("allow");
    expect(run("delete_file", "trusted")).toBe("ask");
    expect(run("email_send", "trusted")).toBe("ask");
    expect(run("vercel_trigger_deploy", "trusted")).toBe("ask");
  });

  it("sandbox_only denies everything with outside effects without asking", () => {
    for (const tool of ["github_push_file", "delete_file", "email_send", "stripe_create_price", "apify_run_actor"]) {
      expect(run(tool, "sandbox_only")).toBe("deny");
    }
  });
});

describe("pre-approval", () => {
  it("a run grant lets an external write through in review_required", () => {
    expect(run("github_push_file", "review_required", { grants: new Set(["github_push_file"]) })).toBe("allow");
  });

  it("an agent auto-approve rule lets destructive and external writes through", () => {
    const p = policy({ autoApprove: ["delete_file", "github_create_pr"] });
    expect(run("delete_file", "review_required", { policy: p })).toBe("allow");
    expect(run("github_create_pr", "review_required", { policy: p })).toBe("allow");
  });

  it("no grant or rule can waive approval for communication or spend", () => {
    const p = policy({ autoApprove: ["email_send", "stripe_create_product"] });
    const grants = new Set(["email_send", "stripe_create_product", "vercel_trigger_deploy"]);
    for (const mode of ["review_required", "trusted"] as const) {
      expect(run("email_send", mode, { policy: p, grants })).toBe("ask");
      expect(run("stripe_create_product", mode, { policy: p, grants })).toBe("ask");
      expect(run("vercel_trigger_deploy", mode, { policy: p, grants })).toBe("ask");
    }
  });

  it("grants do not override read-only preview mode", () => {
    expect(run("github_push_file", "sandbox_only", { grants: new Set(["github_push_file"]) })).toBe("deny");
  });
});

describe("always-ask rules", () => {
  it("make a normally allowed tool ask, even in trusted mode", () => {
    const p = policy({ alwaysAsk: ["github_push_file", "write_file"] });
    expect(run("github_push_file", "trusted", { policy: p })).toBe("ask");
    expect(run("write_file", "trusted", { policy: p })).toBe("ask");
  });

  it("win over a grant or auto-approve rule", () => {
    const p = policy({ alwaysAsk: ["delete_file"], autoApprove: ["delete_file"] });
    expect(run("delete_file", "review_required", { policy: p, grants: new Set(["delete_file"]) })).toBe("ask");
  });

  it("never block a pure read", () => {
    expect(run("web_search", "trusted", { policy: policy({ alwaysAsk: ["web_search"] }) })).toBe("allow");
  });
});

describe("decision details", () => {
  it("reports the risk class and a reason", () => {
    const d = decide({ toolName: "email_send", input: {}, mode: "trusted" });
    expect(d).toMatchObject({ action: "ask", risk: "external_comms" });
    expect(d.reason).toMatch(/people|publicly/i);
  });

  it("treats a read-only SQL query as low risk and a mutation as an external write", () => {
    expect(decide({ toolName: "supabase_run_query", input: { sql: "select 1" }, mode: "review_required" }).action).toBe("allow");
    expect(decide({ toolName: "supabase_run_query", input: { sql: "delete from t" }, mode: "review_required" }).action).toBe("ask");
  });

  it("asks for a tool it has never heard of", () => {
    expect(run("brand_new_tool", "review_required")).toBe("ask");
  });
});
