-- AlterTable
ALTER TABLE "Approval" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "Approval" ADD COLUMN "toolName" TEXT;
ALTER TABLE "Approval" ADD COLUMN "payloadJson" TEXT;
ALTER TABLE "Approval" ADD COLUMN "decisionScope" TEXT;

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT,
    "agentsPaused" BOOLEAN NOT NULL DEFAULT false,
    "perRunBudgetCents" INTEGER,
    "dailyBudgetCents" INTEGER,
    "autoApproveJson" TEXT NOT NULL DEFAULT '[]',
    "alwaysAskJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Policy_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Approval_sessionId_idx" ON "Approval"("sessionId");

-- CreateIndex
CREATE INDEX "Policy_organizationId_idx" ON "Policy"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_organizationId_agentId_key" ON "Policy"("organizationId", "agentId");
