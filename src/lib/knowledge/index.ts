import type { Run } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { parseStoredHandoff, renderHandoff } from "@/lib/agents/engine/handoff";
import { chunkText } from "./chunk";

/**
 * Keeps KnowledgeChunk in step with what the company has written: files (the business plan included), chat, and
 * what finished runs produced. Run summaries are indexed when a run closes out; files and chat are brought up to
 * date incrementally by `syncKnowledge` before a search, so nothing has to remember to index them.
 */

export type SourceType = "file" | "chat" | "run_summary";

const MAX_DOCUMENT_CHARS = 60_000;
const CHAT_BATCH = 500;
const RUN_BATCH = 200;

export async function indexDocument(doc: {
  orgId: string;
  sourceType: SourceType;
  sourceId: string;
  title: string;
  text: string;
  href?: string | null;
  departmentSlug?: string | null;
  sourceUpdatedAt: Date;
}): Promise<number> {
  const chunks = chunkText(doc.text.slice(0, MAX_DOCUMENT_CHARS));
  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { sourceType: doc.sourceType, sourceId: doc.sourceId } }),
    prisma.knowledgeChunk.createMany({
      data: chunks.map((content, chunkIndex) => ({
        organizationId: doc.orgId,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        chunkIndex,
        title: doc.title.slice(0, 200),
        content,
        href: doc.href ?? null,
        departmentSlug: doc.departmentSlug ?? null,
        sourceUpdatedAt: doc.sourceUpdatedAt
      }))
    })
  ]);
  return chunks.length;
}

function previewTextOf(metadataJson: string | null): string {
  if (!metadataJson) return "";
  try {
    const meta = JSON.parse(metadataJson) as { previewText?: unknown };
    return typeof meta.previewText === "string" ? meta.previewText : "";
  } catch {
    return "";
  }
}

// ── Run summaries ─────────────────────────────────────────────────────────────

/** What a finished run produced, as searchable text: its handoff when it gave one, otherwise its output. */
export async function indexRunSummary(run: Pick<Run, "id" | "organizationId" | "sessionId" | "agentId" | "taskId" | "status" | "resultJson" | "outputText" | "finishedAt" | "kind">) {
  if (run.status !== "completed" || run.kind === "consult") return 0;
  const handoff = parseStoredHandoff(run.resultJson);
  const text = handoff ? renderHandoff(handoff) : run.outputText;
  if (!text.trim()) return 0;
  const [agent, task] = await Promise.all([
    prisma.agent.findUnique({ where: { id: run.agentId }, select: { name: true, department: { select: { slug: true } } } }),
    run.taskId ? prisma.task.findUnique({ where: { id: run.taskId }, select: { title: true } }) : null
  ]);
  return indexDocument({
    orgId: run.organizationId,
    sourceType: "run_summary",
    sourceId: run.id,
    title: `${agent?.name ?? "Agent"}: ${task?.title ?? "run"}`,
    text,
    href: `/org/${run.organizationId}/canvas?session=${run.sessionId}`,
    departmentSlug: agent?.department.slug ?? null,
    sourceUpdatedAt: run.finishedAt ?? new Date()
  });
}

// ── Incremental sync ──────────────────────────────────────────────────────────

const g = globalThis as typeof globalThis & { _steveKnowledgeSync?: Map<string, string> };
const lastFingerprint: Map<string, string> = (g._steveKnowledgeSync ??= new Map());

/** A cheap summary of an org's sources and index: when it has not changed, there is nothing to sync. */
async function fingerprint(orgId: string): Promise<string> {
  const [files, chat, runs, chunks] = await Promise.all([
    prisma.file.aggregate({ where: { organizationId: orgId, archivedAt: null }, _max: { updatedAt: true }, _count: { _all: true } }),
    prisma.chatMessage.aggregate({ where: { organizationId: orgId }, _max: { createdAt: true }, _count: { _all: true } }),
    prisma.run.aggregate({ where: { organizationId: orgId, status: "completed" }, _max: { finishedAt: true }, _count: { _all: true } }),
    prisma.knowledgeChunk.count({ where: { organizationId: orgId } })
  ]);
  return [
    files._max.updatedAt?.getTime(), files._count._all,
    chat._max.createdAt?.getTime(), chat._count._all,
    runs._max.finishedAt?.getTime(), runs._count._all,
    chunks
  ].join("|");
}

/** Bring an org's index up to date. A few aggregate queries when nothing changed. */
export async function syncKnowledge(orgId: string, options: { force?: boolean } = {}): Promise<{ files: number; chat: number; runs: number }> {
  const before = await fingerprint(orgId);
  if (!options.force && lastFingerprint.get(orgId) === before) return { files: 0, chat: 0, runs: 0 };
  const [files, chat, runs] = [await syncFiles(orgId), await syncChat(orgId), await syncRuns(orgId)];
  // The state seen before syncing: anything that changed during the sync (or the sync's own new chunks) makes the
  // next search look once more, which then finds nothing stale and settles.
  lastFingerprint.set(orgId, before);
  return { files, chat, runs };
}

async function syncFiles(orgId: string): Promise<number> {
  const [files, indexed] = await Promise.all([
    prisma.file.findMany({ where: { organizationId: orgId, archivedAt: null }, select: { id: true, updatedAt: true } }),
    prisma.knowledgeChunk.findMany({
      where: { organizationId: orgId, sourceType: "file", chunkIndex: 0 },
      select: { sourceId: true, sourceUpdatedAt: true }
    })
  ]);
  const indexedAt = new Map(indexed.map((row) => [row.sourceId, row.sourceUpdatedAt.getTime()]));
  const live = new Set(files.map((file) => file.id));

  // Files that were deleted or archived leave the index.
  const gone = indexed.filter((row) => !live.has(row.sourceId)).map((row) => row.sourceId);
  if (gone.length) await prisma.knowledgeChunk.deleteMany({ where: { sourceType: "file", sourceId: { in: gone } } });

  const stale = files.filter((file) => indexedAt.get(file.id) !== file.updatedAt.getTime()).map((file) => file.id);
  let count = 0;
  for (const id of stale) {
    const file = await prisma.file.findUnique({
      where: { id },
      select: { id: true, name: true, updatedAt: true, metadataJson: true, department: { select: { slug: true } } }
    });
    if (!file) continue;
    const text = previewTextOf(file.metadataJson);
    // A file with no readable text (an image, a binary) is still findable by its name.
    await indexDocument({
      orgId,
      sourceType: "file",
      sourceId: file.id,
      title: file.name,
      text: text || file.name,
      href: `/org/${orgId}/canvas?file=${file.id}`,
      departmentSlug: file.department?.slug ?? null,
      sourceUpdatedAt: file.updatedAt
    });
    count += 1;
  }
  return count;
}

async function syncChat(orgId: string): Promise<number> {
  const newest = await prisma.knowledgeChunk.findFirst({
    where: { organizationId: orgId, sourceType: "chat" },
    orderBy: { sourceUpdatedAt: "desc" },
    select: { sourceUpdatedAt: true }
  });
  const messages = await prisma.chatMessage.findMany({
    where: {
      organizationId: orgId,
      ...(newest ? { createdAt: { gt: newest.sourceUpdatedAt } } : {}),
      // An agent's run output in task chat is indexed once, as that run's summary.
      OR: [{ metadataJson: null }, { NOT: { metadataJson: { contains: '"kind":"agent_' } } }]
    },
    include: { thread: { select: { title: true, kind: true, taskId: true } } },
    orderBy: { createdAt: "asc" },
    take: CHAT_BATCH
  });
  let count = 0;
  for (const message of messages) {
    if (message.body.trim().length < 20) continue;
    const who = message.senderType === "user" ? "Founder" : message.senderType === "agent" ? "Agent" : "System";
    await indexDocument({
      orgId,
      sourceType: "chat",
      sourceId: message.id,
      title: `${message.thread.title ?? "Chat"} (${who})`,
      text: message.body,
      href: message.thread.taskId ? `/org/${orgId}/canvas?task=${message.thread.taskId}` : `/org/${orgId}/canvas?tab=cofounder`,
      sourceUpdatedAt: message.createdAt
    });
    count += 1;
  }
  return count;
}

/** Runs that finished while indexing at close-out was not possible (or before this existed). */
async function syncRuns(orgId: string): Promise<number> {
  const newest = await prisma.knowledgeChunk.findFirst({
    where: { organizationId: orgId, sourceType: "run_summary" },
    orderBy: { sourceUpdatedAt: "desc" },
    select: { sourceUpdatedAt: true }
  });
  const runs = await prisma.run.findMany({
    where: {
      organizationId: orgId,
      status: "completed",
      kind: { not: "consult" },
      ...(newest ? { finishedAt: { gt: newest.sourceUpdatedAt } } : {})
    },
    orderBy: { finishedAt: "asc" },
    take: RUN_BATCH
  });
  let count = 0;
  for (const run of runs) if ((await indexRunSummary(run)) > 0) count += 1;
  return count;
}
