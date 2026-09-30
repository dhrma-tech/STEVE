-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "taskId" TEXT,
    "agentId" TEXT NOT NULL,
    "parentRunId" TEXT,
    "parentSlotId" TEXT,
    "rootRunId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "callChainJson" TEXT NOT NULL DEFAULT '[]',
    "mode" TEXT NOT NULL DEFAULT 'review_required',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requestText" TEXT NOT NULL,
    "outputText" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT,
    "stateJson" TEXT,
    "limitsJson" TEXT,
    "grantsJson" TEXT NOT NULL DEFAULT '[]',
    "spentCents" REAL NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "toolCalls" INTEGER NOT NULL DEFAULT 0,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "eventSeq" INTEGER NOT NULL DEFAULT 0,
    "lockedBy" TEXT,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Run_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Run_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaskSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "runId" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedBy" TEXT,
    "lockedUntil" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Run_sessionId_key" ON "Run"("sessionId");

-- CreateIndex
CREATE INDEX "Run_organizationId_status_idx" ON "Run"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Run_rootRunId_idx" ON "Run"("rootRunId");

-- CreateIndex
CREATE INDEX "Run_status_updatedAt_idx" ON "Run"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Run_parentRunId_parentSlotId_key" ON "Run"("parentRunId", "parentSlotId");

-- CreateIndex
CREATE INDEX "RunEvent_runId_idx" ON "RunEvent"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvent_runId_seq_key" ON "RunEvent"("runId", "seq");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_runId_status_idx" ON "Job"("runId", "status");

-- CreateIndex
CREATE INDEX "Job_dedupeKey_status_idx" ON "Job"("dedupeKey", "status");
