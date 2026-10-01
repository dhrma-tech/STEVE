-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "planNodeId" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'drafting',
    "summary" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "replanCount" INTEGER NOT NULL DEFAULT 0,
    "maxReplans" INTEGER NOT NULL DEFAULT 2,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "roadmapItemId" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "orchestratorAgentId" TEXT NOT NULL,
    "taskId" TEXT,
    "estimatedCostCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT,
    "reportText" TEXT,
    "errorMessage" TEXT,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanNode" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "agentId" TEXT,
    "departmentId" TEXT,
    "taskId" TEXT,
    "runId" TEXT,
    "reviewRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dependsOnJson" TEXT NOT NULL DEFAULT '[]',
    "acceptanceCriteriaJson" TEXT NOT NULL DEFAULT '[]',
    "review" BOOLEAN NOT NULL DEFAULT false,
    "estimatedCostCents" DOUBLE PRECISION,
    "estimatedMinutes" INTEGER,
    "riskNotes" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "resultJson" TEXT,
    "reviewJson" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_organizationId_status_idx" ON "Plan"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Plan_status_updatedAt_idx" ON "Plan"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "PlanNode_planId_status_idx" ON "PlanNode"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanNode_planId_key_key" ON "PlanNode"("planId", "key");

-- CreateIndex
CREATE INDEX "Run_planId_idx" ON "Run"("planId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanNode" ADD CONSTRAINT "PlanNode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
