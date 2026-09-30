/**
 * Helpers for tests that use the real (temporary) database created by tests/setup-db.ts.
 */
import Database from "better-sqlite3";
import { prisma } from "@/lib/db/client";
import { Worker } from "@/lib/agents/engine/worker";

export const ORG = "org_test";
/** A user who can review approvals (approvals record who decided, and that is a real foreign key). */
export const USER = "user_1";

function databasePath(): string {
  const path = process.env.STEVE_TEST_DB_PATH;
  if (!path) throw new Error("STEVE_TEST_DB_PATH is not set: tests must run through tests/setup-db.ts");
  return path;
}

/** Empty every table (keeping the schema and the migration ledger) and recreate the test organization. */
export async function resetDb(): Promise<void> {
  const db = new Database(databasePath());
  try {
    db.pragma("foreign_keys = OFF");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_local_migrations'")
      .all() as Array<{ name: string }>;
    for (const { name } of tables) db.exec(`DELETE FROM "${name}"`);
    db.pragma("foreign_keys = ON");
  } finally {
    db.close();
  }
  await prisma.organization.create({ data: { id: ORG, name: "Test Org", slug: "test-org" } });
  await prisma.user.create({ data: { id: USER, email: "reviewer@test.example", name: "Reviewer" } });
}

/** Run raw SQL against the test database (to simulate things like an expired lease). */
export function rawExec(sql: string, ...params: unknown[]): void {
  const db = new Database(databasePath());
  try {
    db.prepare(sql).run(...params);
  } finally {
    db.close();
  }
}

export async function seedAgent(opts: {
  slug: string;
  name: string;
  departmentSlug: string;
  permissionMode?: "review_required" | "sandbox_only" | "trusted";
  skillKeys?: string[];
  isDefault?: boolean;
  organizationId?: string;
}) {
  const organizationId = opts.organizationId ?? ORG;
  if (organizationId !== ORG) {
    await prisma.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: { id: organizationId, name: organizationId, slug: organizationId }
    });
  }
  const existing = await prisma.department.findFirst({ where: { organizationId, slug: opts.departmentSlug } });
  const department =
    existing ??
    (await prisma.department.create({
      data: {
        organizationId,
        slug: opts.departmentSlug,
        name: opts.departmentSlug,
        description: `${opts.departmentSlug} department`,
        icon: "box",
        color: "#888888",
        sortOrder: 0,
        contextJson: "{}"
      }
    }));
  return prisma.agent.create({
    data: {
      organizationId,
      departmentId: department.id,
      name: opts.name,
      slug: opts.slug,
      isDefault: opts.isDefault ?? false,
      status: "idle",
      model: "claude-sonnet-sandbox",
      toolsJson: JSON.stringify({ skillKeys: opts.skillKeys ?? [] }),
      permissionsJson: JSON.stringify({ mode: opts.permissionMode ?? "trusted" })
    }
  });
}

export async function seedTask(opts: {
  agentId?: string | null;
  departmentId?: string | null;
  title?: string;
  organizationId?: string;
  status?: string;
}) {
  return prisma.task.create({
    data: {
      organizationId: opts.organizationId ?? ORG,
      agentId: opts.agentId ?? null,
      departmentId: opts.departmentId ?? null,
      title: opts.title ?? "Queued task",
      type: "agent_task",
      status: opts.status ?? "queued"
    }
  });
}

/** A running task + session for an agent, the way the launch path creates them. */
export async function seedSession(agentId: string, title = "Test task") {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
  const task = await seedTask({
    agentId,
    departmentId: agent.departmentId,
    title,
    status: "running",
    organizationId: agent.organizationId
  });
  return prisma.taskSession.create({
    data: { organizationId: agent.organizationId, taskId: task.id, agentId, status: "running" }
  });
}

/** A worker for tests: handles jobs one at a time on demand. */
export function testWorker(options: { id?: string; leaseMs?: number; runningStaleMs?: number; waitingStaleMs?: number } = {}) {
  return new Worker({ id: options.id ?? "test-worker", concurrency: 1, ...options });
}

/** Let every due job run until the queue is quiet. Returns the number of jobs handled. */
export async function drainAll(worker = testWorker(), maxRounds = 200): Promise<number> {
  let total = 0;
  for (let round = 0; round < maxRounds; round++) {
    const handled = await worker.drain({ maxMs: 20_000 });
    total += handled;
    if (handled === 0) break;
  }
  return total;
}
