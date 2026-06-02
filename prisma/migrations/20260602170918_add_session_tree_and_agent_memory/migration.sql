-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT,
    "parentSessionId" TEXT,
    "status" TEXT NOT NULL,
    "browserUrl" TEXT,
    "replayUrl" TEXT,
    "scratchpad" TEXT,
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskSession_parentSessionId_fkey" FOREIGN KEY ("parentSessionId") REFERENCES "TaskSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskSession" ("agentId", "browserUrl", "createdAt", "elapsedMs", "finishedAt", "id", "organizationId", "replayUrl", "scratchpad", "startedAt", "status", "taskId", "updatedAt") SELECT "agentId", "browserUrl", "createdAt", "elapsedMs", "finishedAt", "id", "organizationId", "replayUrl", "scratchpad", "startedAt", "status", "taskId", "updatedAt" FROM "TaskSession";
DROP TABLE "TaskSession";
ALTER TABLE "new_TaskSession" RENAME TO "TaskSession";
CREATE INDEX "TaskSession_taskId_idx" ON "TaskSession"("taskId");
CREATE INDEX "TaskSession_organizationId_status_idx" ON "TaskSession"("organizationId", "status");
CREATE INDEX "TaskSession_parentSessionId_idx" ON "TaskSession"("parentSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AgentMemory_agentId_idx" ON "AgentMemory"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_agentId_key_key" ON "AgentMemory"("agentId", "key");
