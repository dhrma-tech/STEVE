/**
 * Helpers for tests that use the real (temporary) Postgres database created by tests/setup-db.ts.
 */
import { prisma } from "@/lib/db/client";
import { Worker } from "@/lib/agents/engine/worker";

export const ORG = "org_test";
/** A user who can review approvals (approvals record who decided, and that is a real foreign key). */
export const USER = "user_1";

let tableList: string | null = null;

/** Empty every table (keeping the schema) and recreate the test organization. */
export async function resetDb(): Promise<void> {
  if (!tableList) {
    const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
    );
    tableList = rows.map((row) => `"${row.tablename}"`).join(", ");
  }
  await prisma.$executeRawUnsafe(`TRUNCATE ${tableList} CASCADE`);
  await prisma.organization.create({ data: { id: ORG, name: "Test Org", slug: "test-org" } });
  await prisma.user.create({ data: { id: USER, email: "reviewer@test.example", name: "Reviewer" } });
}

/** A time relative to now, for backdating leases, expiries and timestamps in tests. */
export const ago = (ms: number) => new Date(Date.now() - ms);
export const fromNow = (ms: number) => new Date(Date.now() + ms);

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
