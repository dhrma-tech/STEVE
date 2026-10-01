-- Phase 6: shared memory (OrgMemory + history) and searchable knowledge. AgentMemory rows are carried over as
-- agent-scoped memories before the old table is dropped.

-- CreateTable
CREATE TABLE "OrgMemory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "confidence" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "sourceRunId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMemoryRevision" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMemoryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "departmentSlug" TEXT,
    "href" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgMemory_organizationId_status_idx" ON "OrgMemory"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMemory_organizationId_scope_key_key" ON "OrgMemory"("organizationId", "scope", "key");

-- CreateIndex
CREATE INDEX "OrgMemoryRevision_memoryId_createdAt_idx" ON "OrgMemoryRevision"("memoryId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_organizationId_sourceType_idx" ON "KnowledgeChunk"("organizationId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_sourceType_sourceId_chunkIndex_key" ON "KnowledgeChunk"("sourceType", "sourceId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "OrgMemory" ADD CONSTRAINT "OrgMemory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMemoryRevision" ADD CONSTRAINT "OrgMemoryRevision_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "OrgMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry AgentMemory over: each agent's notes become memories scoped to that agent. Keys are normalized the way
-- src/lib/memory/store.ts normalizes them; if two old keys normalize to the same key, the newest value is kept.
INSERT INTO "OrgMemory" ("id", "organizationId", "scope", "key", "value", "status", "source", "createdAt", "updatedAt")
SELECT DISTINCT ON (a."organizationId", m."agentId", left(lower(regexp_replace(m."key", '[^a-zA-Z0-9_-]', '_', 'g')), 80))
    'mig_' || m."id",
    a."organizationId",
    'agent:' || m."agentId",
    left(lower(regexp_replace(m."key", '[^a-zA-Z0-9_-]', '_', 'g')), 80),
    m."value",
    'active',
    'migrated',
    m."updatedAt",
    m."updatedAt"
FROM "AgentMemory" m
JOIN "Agent" a ON a."id" = m."agentId"
WHERE length(trim(m."key")) > 0
ORDER BY a."organizationId", m."agentId", left(lower(regexp_replace(m."key", '[^a-zA-Z0-9_-]', '_', 'g')), 80), m."updatedAt" DESC;

-- DropForeignKey
ALTER TABLE "AgentMemory" DROP CONSTRAINT "AgentMemory_agentId_fkey";

-- DropTable
DROP TABLE "AgentMemory";
