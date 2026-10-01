import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { searchTerms } from "./chunk";
import { syncKnowledge } from "./index";

/**
 * Search the company's knowledge with Postgres full-text search: files (business plan included), chat, run
 * summaries and active memory. Every term must match first; when that finds too little, any term may match, so a
 * question phrased in plain words still finds the right passage.
 */

export type KnowledgeHit = {
  kind: "file" | "chat" | "run_summary" | "memory";
  id: string;
  sourceId: string;
  title: string;
  snippet: string;
  href: string | null;
  rank: number;
};

type ChunkRow = { id: string; sourceType: string; sourceId: string; title: string; snippet: string; href: string | null; rank: number };
type MemoryRow = { id: string; scope: string; key: string; value: string; rank: number };

const HEADLINE = "MaxWords=35, MinWords=12, MaxFragments=2, FragmentDelimiter=\" … \", StartSel=**, StopSel=**";

async function chunkSearch(orgId: string, tsquery: Prisma.Sql, limit: number, exclude: string[]): Promise<ChunkRow[]> {
  return prisma.$queryRaw<ChunkRow[]>`
    SELECT c."id", c."sourceType", c."sourceId", c."title", c."href",
           ts_headline('english', c."content", q, ${HEADLINE}) AS snippet,
           ts_rank(to_tsvector('english', regexp_replace(c."title", '[._-]+', ' ', 'g') || ' ' || c."content"), q) AS rank
    FROM "KnowledgeChunk" c, ${tsquery} q
    WHERE c."organizationId" = ${orgId}
      AND to_tsvector('english', regexp_replace(c."title", '[._-]+', ' ', 'g') || ' ' || c."content") @@ q
      ${exclude.length ? Prisma.sql`AND c."id" NOT IN (${Prisma.join(exclude)})` : Prisma.empty}
    ORDER BY rank DESC, c."sourceUpdatedAt" DESC
    LIMIT ${limit}`;
}

async function memorySearch(orgId: string, tsquery: Prisma.Sql, scopes: string[] | null, limit: number): Promise<MemoryRow[]> {
  return prisma.$queryRaw<MemoryRow[]>`
    SELECT m."id", m."scope", m."key", m."value",
           ts_rank(to_tsvector('english', replace(m."key", '_', ' ') || ' ' || m."value"), q) AS rank
    FROM "OrgMemory" m, ${tsquery} q
    WHERE m."organizationId" = ${orgId} AND m."status" = 'active'
      ${scopes ? Prisma.sql`AND m."scope" IN (${Prisma.join(scopes)})` : Prisma.empty}
      AND to_tsvector('english', replace(m."key", '_', ' ') || ' ' || m."value") @@ q
    ORDER BY rank DESC
    LIMIT ${limit}`;
}

export async function searchKnowledge(params: {
  orgId: string;
  query: string;
  limit?: number;
  /** Memory scopes the searcher may see (an agent's); null for the founder, who sees all. */
  memoryScopes?: string[] | null;
  includeMemory?: boolean;
}): Promise<KnowledgeHit[]> {
  const query = params.query.trim().slice(0, 300);
  const limit = Math.min(Math.max(params.limit ?? 6, 1), 20);
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  await syncKnowledge(params.orgId);

  const all = Prisma.sql`websearch_to_tsquery('english', ${query})`;
  const any = Prisma.sql`to_tsquery('english', ${terms.join(" | ")})`;

  let chunks = await chunkSearch(params.orgId, all, limit, []);
  if (chunks.length < limit) chunks = [...chunks, ...(await chunkSearch(params.orgId, any, limit - chunks.length, chunks.map((c) => c.id)))];

  let memories: MemoryRow[] = [];
  if (params.includeMemory !== false) {
    const scopes = params.memoryScopes ?? null;
    memories = await memorySearch(params.orgId, all, scopes, 3);
    if (memories.length === 0) memories = await memorySearch(params.orgId, any, scopes, 3);
  }

  const hits: KnowledgeHit[] = [
    ...memories.map((m) => ({
      kind: "memory" as const,
      id: m.id,
      sourceId: m.id,
      title: `Memory: ${m.key} (${m.scope})`,
      snippet: m.value.length > 300 ? `${m.value.slice(0, 300)}…` : m.value,
      href: null,
      // Memory is curated, so a match ranks a little above a passage with the same score.
      rank: Number(m.rank) * 1.2
    })),
    ...chunks.map((c) => ({
      kind: c.sourceType as KnowledgeHit["kind"],
      id: c.id,
      sourceId: c.sourceId,
      title: c.title,
      snippet: c.snippet,
      href: c.href,
      rank: Number(c.rank)
    }))
  ];
  return hits.sort((a, b) => b.rank - a.rank).slice(0, limit);
}

/** Search results as text for an agent. */
export function renderHits(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return "Nothing in the company's knowledge matches that. Try other words, or ask a teammate.";
  const label: Record<KnowledgeHit["kind"], string> = { file: "File", chat: "Chat", run_summary: "Past work", memory: "Memory" };
  return hits.map((hit, index) => `${index + 1}. [${label[hit.kind]}] ${hit.title}\n${hit.snippet}`).join("\n\n");
}
