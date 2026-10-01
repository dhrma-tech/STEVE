import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { scriptedModel, type ScriptedTurn } from "@/lib/agents/testing/scripted-anthropic";
import { drainAll, ORG, resetDb, seedAgent, seedTask, USER } from "@/lib/agents/testing/test-db";
import { startAgentRun } from "@/lib/agents/run-service";
import { getRunBySession, listEvents } from "@/lib/agents/engine/run-store";
import { resetCircuits } from "@/lib/agents/engine/models";
import { resolveApproval } from "@/lib/agents/policy/approvals";
import { updatePolicy } from "@/lib/agents/policy/store";
import { getMissionOverview, getRunDetail } from "@/lib/mission/data";
import { updateSchedule, createSchedule } from "@/lib/automations/schedules";
import { decryptSecret, encryptSecret, needsRewrap } from "./crypto";
import { getOrgCredential, migratePlaintextIntegrationCredentials, publicConfig, readOrgCredential, rotateStoredSecrets, setOrgCredential, credentialKey } from "./vault";
import { completeOAuth, getOAuthAccessToken, OAuthError, startOAuth } from "@/lib/integrations/oauth";
import { hitRateLimit } from "./rate-limit";
import { redactCardNumbers, redactPii } from "./pii-patterns";
import { forgetPiiSetting } from "./pii";
import { applyRetention, updateDataSettings } from "./retention";
import { getHealth, recordWorkerHeartbeat } from "@/lib/observability/health";

const tools = vi.hoisted(() => ({ output: { text: "ok" } }));

vi.mock("@anthropic-ai/sdk", async () => (await import("@/lib/agents/testing/scripted-anthropic")).anthropicModuleMock);
vi.mock("@/lib/agents/prompt", () => ({
  buildPrompt: () => ({ system: "SYSTEM PROMPT", user: "USER PROMPT" }),
  loadOrgContext: async () => ({ businessPlan: "", brandKit: "" }),
  maybeExtractAndSaveBrandKit: async () => undefined
}));
vi.mock("@/lib/agents/tools/registry", async () => {
  const s = { type: "string" };
  return {
    buildToolset: () => [
      { definition: { name: "web_search", description: "search", input_schema: { type: "object" as const, properties: { query: s }, required: ["query"] } }, execute: async () => tools.output.text },
      { definition: { name: "github_push_file", description: "push", input_schema: { type: "object" as const, properties: { repo: s }, required: ["repo"] } }, execute: async () => "pushed" }
    ]
  };
});

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");
const call = (name: string, input: Record<string, unknown>): ScriptedTurn => ({ toolCalls: [{ name, input }] });

beforeEach(async () => {
  await resetDb();
  scriptedModel.load([]);
  resetCircuits();
  forgetPiiSetting(ORG);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("AGENTS_PAUSED", "");
  vi.stubEnv("MODEL_RETRY_BASE_MS", "0");
});
afterEach(() => vi.unstubAllEnvs());

describe("encryption and key rotation", () => {
  it("uses a fresh data key per value, wrapped by the active master key", () => {
    vi.stubEnv("SECRETS_MASTER_KEYS", `k1:${KEY_A}`);
    const a = encryptSecret("same value");
    const b = encryptSecret("same value");
    expect(a).not.toBe(b);
    expect(a.split(":").slice(0, 2)).toEqual(["v2", "k1"]);
    expect(decryptSecret(a)).toBe("same value");
  });

  it("decrypts old values after a new key is added, and refuses values whose key was removed", () => {
    vi.stubEnv("SECRETS_MASTER_KEYS", `k1:${KEY_A}`);
    const old = encryptSecret("rotate me");
    vi.stubEnv("SECRETS_MASTER_KEYS", `k2:${KEY_B},k1:${KEY_A}`);
    expect(decryptSecret(old)).toBe("rotate me");
    expect(needsRewrap(old)).toBe(true);
    expect(needsRewrap(encryptSecret("new"))).toBe(false);
    vi.stubEnv("SECRETS_MASTER_KEYS", `k2:${KEY_B}`);
    expect(() => decryptSecret(old)).toThrow(/not in the key ring/);
  });

  it("re-encrypts every stored secret with the active key", async () => {
    vi.stubEnv("SECRETS_MASTER_KEYS", `k1:${KEY_A}`);
    await setOrgCredential({ orgId: ORG, provider: "github", field: "token", value: "gh-token-value" });
    await prisma.notificationChannel.create({
      data: { organizationId: ORG, kind: "webhook", name: "x", urlCiphertext: encryptSecret("https://x.example/h"), urlHint: "x", secretCiphertext: encryptSecret("whsec_x") }
    });
    vi.stubEnv("SECRETS_MASTER_KEYS", `k2:${KEY_B},k1:${KEY_A}`);
    expect(await rotateStoredSecrets()).toEqual({ checked: 3, rewrapped: 3, failed: 0 });
    vi.stubEnv("SECRETS_MASTER_KEYS", `k2:${KEY_B}`);
    expect(await readOrgCredential(ORG, "github", "token")).toBe("gh-token-value");
    const channel = await prisma.notificationChannel.findFirstOrThrow();
    expect(decryptSecret(channel.secretCiphertext!)).toBe("whsec_x");
    expect(await rotateStoredSecrets()).toEqual({ checked: 3, rewrapped: 0, failed: 0 });
  });
});

describe("credential vault", () => {
  it("stores credentials encrypted under per-org keys and never in plain config", async () => {
    await setOrgCredential({ orgId: ORG, provider: "supabase", field: "serviceRoleKey", value: "service-role-secret" });
    const row = await prisma.secret.findFirstOrThrow({ where: { key: credentialKey("supabase", "serviceRoleKey") } });
    expect(row.key).toBe("SUPABASE_SERVICE_ROLE_KEY");
    expect(row.valueCiphertext).not.toContain("service-role-secret");
    expect(await readOrgCredential(ORG, "supabase", "serviceRoleKey")).toBe("service-role-secret");
    // Another org cannot read it.
    await seedAgent({ slug: "a", name: "A", departmentSlug: "engineering", organizationId: "org_other" });
    expect(await readOrgCredential("org_other", "supabase", "serviceRoleKey")).toBeNull();
  });

  it("falls back to global environment credentials only outside production (or when allowed)", async () => {
    vi.stubEnv("GITHUB_TOKEN", "global-token");
    expect(await getOrgCredential(ORG, "github", "token", "GITHUB_TOKEN")).toBe("global-token");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "a-production-secret-of-at-least-32-characters");
    expect(await getOrgCredential(ORG, "github", "token", "GITHUB_TOKEN")).toBeNull();
    vi.stubEnv("ALLOW_GLOBAL_TOOL_CREDENTIALS", "1");
    expect(await getOrgCredential(ORG, "github", "token", "GITHUB_TOKEN")).toBe("global-token");
    vi.stubEnv("ALLOW_GLOBAL_TOOL_CREDENTIALS", "");
    await setOrgCredential({ orgId: ORG, provider: "github", field: "token", value: "org-token" });
    expect(await getOrgCredential(ORG, "github", "token", "GITHUB_TOKEN")).toBe("org-token");
  });

  it("moves plaintext credentials out of integration config and hides secret fields from responses", async () => {
    await prisma.integration.create({
      data: { organizationId: ORG, provider: "github", status: "connected", mode: "sandbox", configJson: JSON.stringify({ token: "plain-gh", owner: "acme" }) }
    });
    expect(await migratePlaintextIntegrationCredentials()).toBe(1);
    const integration = await prisma.integration.findFirstOrThrow();
    expect(JSON.parse(integration.configJson!)).toEqual({ owner: "acme" });
    expect(await readOrgCredential(ORG, "github", "token")).toBe("plain-gh");
    expect(publicConfig(JSON.stringify({ apiKey: "x", serviceRoleKey: "y", authToken: "z", projectRef: "abc", fromAddress: "a@b.c" }))).toEqual({ projectRef: "abc", fromAddress: "a@b.c" });
  });
});

describe("OAuth connect", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("SUPABASE_OAUTH_CLIENT_SECRET", "client-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://steve.example");
  });
  const isAdmin = async () => true;

  it("sends the user to the provider with encrypted state and a PKCE challenge, then stores the tokens in the vault", async () => {
    const { url, nonce } = startOAuth({ orgId: ORG, userId: USER, provider: "supabase" });
    const authorize = new URL(url);
    expect(authorize.origin + authorize.pathname).toBe("https://api.supabase.com/v1/oauth/authorize");
    expect(authorize.searchParams.get("redirect_uri")).toBe("https://steve.example/api/oauth/supabase/callback");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    const state = authorize.searchParams.get("state")!;
    expect(state).not.toContain(ORG);

    const requests: Array<{ body: string; auth: string | null }> = [];
    const fetchStub = vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push({ body: String(init?.body), auth: (init?.headers as Record<string, string>).authorization ?? null });
      return Response.json({ access_token: "sb-access", refresh_token: "sb-refresh", expires_in: 3600 });
    }) as unknown as typeof fetch;
    const { orgId } = await completeOAuth({ provider: "supabase", code: "the-code", state, nonceCookie: nonce, userId: USER, isOrgAdmin: isAdmin, fetchImpl: fetchStub });
    expect(orgId).toBe(ORG);
    const body = new URLSearchParams(requests[0].body);
    expect(body.get("code_verifier")).toBeTruthy();
    expect(body.get("client_secret")).toBeNull(); // Supabase takes the client credentials as Basic auth
    expect(requests[0].auth).toMatch(/^Basic /);
    expect(await readOrgCredential(ORG, "supabase", "accessToken")).toBe("sb-access");
    expect(await readOrgCredential(ORG, "supabase", "refreshToken")).toBe("sb-refresh");
    const integration = await prisma.integration.findFirstOrThrow({ where: { provider: "supabase" } });
    expect(integration).toMatchObject({ status: "connected", mode: "live" });
    expect(integration.configJson).not.toContain("sb-access");
    expect(await prisma.auditLog.count({ where: { action: "integration.oauth_connected" } })).toBe(1);
  });

  it("refuses a callback from another browser, another user, a non-admin, or after ten minutes", async () => {
    const { url, nonce } = startOAuth({ orgId: ORG, userId: USER, provider: "supabase" });
    const state = new URL(url).searchParams.get("state")!;
    const base = { provider: "supabase" as const, code: "c", state, userId: USER, isOrgAdmin: isAdmin, fetchImpl: vi.fn() as unknown as typeof fetch };
    await expect(completeOAuth({ ...base, nonceCookie: "someone-else" })).rejects.toThrow(/same browser/);
    await expect(completeOAuth({ ...base, nonceCookie: nonce, userId: "user_2" })).rejects.toThrow(/different user/);
    await expect(completeOAuth({ ...base, nonceCookie: nonce, isOrgAdmin: async () => false })).rejects.toThrow(/owners and admins/);
    await expect(completeOAuth({ ...base, nonceCookie: nonce, now: Date.now() + 11 * 60 * 1000 })).rejects.toThrow(/took too long/);
    await expect(completeOAuth({ ...base, nonceCookie: nonce, state: "tampered" })).rejects.toBeInstanceOf(OAuthError);
    await expect(completeOAuth({ ...base, provider: "github", nonceCookie: nonce })).rejects.toThrow(/different service/);
  });

  it("refreshes an access token that is about to expire", async () => {
    await setOrgCredential({ orgId: ORG, provider: "supabase", field: "accessToken", value: "old-access" });
    await setOrgCredential({ orgId: ORG, provider: "supabase", field: "refreshToken", value: "the-refresh" });
    await prisma.integration.create({
      data: { organizationId: ORG, provider: "supabase", status: "connected", mode: "live", configJson: JSON.stringify({ accessExpiresAt: new Date(Date.now() + 30_000).toISOString() }) }
    });
    const fetchStub = vi.fn(async () => Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 })) as unknown as typeof fetch;
    expect(await getOAuthAccessToken(ORG, "supabase", fetchStub)).toBe("new-access");
    expect(await readOrgCredential(ORG, "supabase", "refreshToken")).toBe("new-refresh");
    expect(await getOAuthAccessToken(ORG, "supabase", fetchStub)).toBe("new-access"); // fresh now: no second refresh
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});

describe("rate limits", () => {
  it("counts per subject and window, and blocks over the limit with a retry time", async () => {
    vi.stubEnv("RATE_LIMIT_APPROVAL", "3/60");
    const now = new Date("2026-10-01T12:00:10Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit("approval", "user:a", now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBe(50);
    expect((await hitRateLimit("approval", "user:b", now)).allowed).toBe(true); // another subject
    expect((await hitRateLimit("approval", "user:a", new Date("2026-10-01T12:01:01Z"))).allowed).toBe(true); // next window
    vi.stubEnv("RATE_LIMITS", "off");
    expect((await hitRateLimit("approval", "user:a", now)).allowed).toBe(true);
  });
});

describe("personal data", () => {
  it("removes valid card numbers, emails and phone numbers but not ids and amounts", () => {
    expect(redactCardNumbers("card 4242 4242 4242 4242, order 1234567890123")).toBe("card [card number], order 1234567890123");
    expect(redactPii("Mail ada@example.com or call +44 20 7946 0958 / (415) 555-0132 about invoice 20261001 for $1,299.00")).toBe(
      "Mail [email] or call [phone] / [phone] about invoice 20261001 for $1,299.00"
    );
  });

  it("redacts stored run events when the org turns it on, and never stores card numbers", async () => {
    const agent = await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering" });
    await updateDataSettings(ORG, { redactPii: true });
    forgetPiiSetting(ORG);
    tools.output.text = "Contact ada@example.com, card 4242424242424242";
    scriptedModel.load([call("web_search", { query: "x" }), { text: "Found ada@example.com." }]);
    const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId, title: "t" });
    const session = await startAgentRun({ orgId: ORG, taskId: task.id, agentId: agent.id, message: "go" });
    await drainAll();
    const run = (await getRunBySession(session!.id))!;
    const stored = JSON.stringify(await listEvents(run.id, 0));
    expect(stored).not.toContain("ada@example.com");
    expect(stored).not.toContain("4242424242424242");
    expect(stored).toContain("[email]");
    // The model still saw the address in the turn (only storage is redacted); card numbers never reach it.
    expect(JSON.stringify(scriptedModel.calls[1].messages)).toContain("ada@example.com");
    expect(JSON.stringify(scriptedModel.calls[1].messages)).not.toContain("4242424242424242");
  });
});

describe("retention", () => {
  it("deletes old activity of finished runs for orgs that set a retention period, and nothing else", async () => {
    const agent = await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering" });
    const other = await seedAgent({ slug: "engineering-default", name: "Other", departmentSlug: "engineering", organizationId: "org_other" });
    scriptedModel.load([{ text: "a" }, { text: "b" }]);
    for (const a of [agent, other]) {
      const task = await seedTask({ agentId: a.id, departmentId: a.departmentId, title: "t", organizationId: a.organizationId });
      await startAgentRun({ orgId: a.organizationId, taskId: task.id, agentId: a.id, message: "go" });
    }
    await drainAll();
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await prisma.runEvent.updateMany({ data: { createdAt: old } });
    await updateDataSettings(ORG, { retentionDays: 30 });

    const report = await applyRetention();
    expect(report.runEvents).toBeGreaterThan(0);
    expect(await prisma.runEvent.count({ where: { run: { organizationId: ORG } } })).toBe(0);
    expect(await prisma.runEvent.count({ where: { run: { organizationId: "org_other" } } })).toBeGreaterThan(0);
    expect(await prisma.run.count()).toBe(2); // the runs themselves are kept
  });
});

describe("audit log", () => {
  it("records tool calls with the agent as actor, approval decisions, and policy changes", async () => {
    const agent = await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering", permissionMode: "review_required" });
    scriptedModel.load([call("web_search", { query: "x" }), call("github_push_file", { repo: "acme/site" }), { text: "done" }]);
    const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId, title: "t" });
    const session = await startAgentRun({ orgId: ORG, taskId: task.id, agentId: agent.id, message: "go" });
    await drainAll();
    const approval = await prisma.approval.findFirstOrThrow();
    await resolveApproval({ orgId: ORG, sessionId: session!.id, approvalId: approval.id, userId: USER, isAdmin: true, decision: "approve" });
    await drainAll();
    await updatePolicy(ORG, { perRunBudgetCents: 50 }, null, USER);

    const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["tool.web_search", "approval.approved", "tool.github_push_file", "policy.updated"]));
    expect(rows.find((r) => r.action === "tool.web_search")).toMatchObject({ actorAgentId: agent.id });
    expect(rows.find((r) => r.action === "approval.approved")).toMatchObject({ actorUserId: USER });
    expect(JSON.parse(rows.find((r) => r.action === "tool.github_push_file")!.metadataJson!)).toMatchObject({ status: "completed", risk: "external_write" });
  });
});

describe("health", () => {
  it("reports workers down until one reports in", async () => {
    expect((await getHealth()).components.workers.status).toBe("down");
    await recordWorkerHeartbeat("w1", { ok: true });
    const health = await getHealth();
    expect(health.components).toMatchObject({ database: { status: "operational" }, workers: { status: "operational", alive: 1 } });
    expect(health.status).toBe("operational");
  });
});

describe("tenant isolation", () => {
  it("every org API route checks membership (directly or in the library it calls)", () => {
    const root = resolve("src/app/api/orgs/[orgId]");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name === "route.ts") files.push(path);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(50);
    const guard = /require(Org(Member|Writer|Admin)|User)\(/;
    const unguarded = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      if (guard.test(source)) return false;
      // The route delegates to library functions: they must check membership themselves.
      const libs = [...source.matchAll(/from "@\/lib\/([^"]+)"/g)].map((m) => resolve("src/lib", `${m[1]}.ts`)).filter((p) => existsSync(p));
      return !libs.some((lib) => guard.test(readFileSync(lib, "utf8")));
    });
    expect(unguarded.map((f) => f.slice(root.length))).toEqual([]);
  });

  it("org-scoped reads and changes do not reach another org's data", async () => {
    const agent = await seedAgent({ slug: "engineering-default", name: "Engineering Agent", departmentSlug: "engineering" });
    await seedAgent({ slug: "x", name: "X", departmentSlug: "engineering", organizationId: "org_other" });
    scriptedModel.load([{ text: "done" }]);
    const task = await seedTask({ agentId: agent.id, departmentId: agent.departmentId, title: "t" });
    const session = await startAgentRun({ orgId: ORG, taskId: task.id, agentId: agent.id, message: "go" });
    await drainAll();
    const run = (await getRunBySession(session!.id))!;

    expect(await getRunDetail("org_other", run.id)).toBeNull();
    expect((await getMissionOverview("org_other")).trees ?? []).toEqual([]);
    const schedule = await createSchedule(ORG, null, { name: "s", cron: "0 9 * * *", target: "goal", instruction: "Weekly report" });
    expect(await updateSchedule("org_other", schedule.id, { enabled: false })).toBeNull();
    expect(await resolveApproval({ orgId: "org_other", sessionId: session!.id, approvalId: "nope", userId: USER, isAdmin: true, decision: "approve" })).toMatchObject({ kind: "not_found" });
  });
});
