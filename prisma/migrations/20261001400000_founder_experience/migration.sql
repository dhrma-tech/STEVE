-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "editedPayloadJson" TEXT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "dailyBudgetCents" INTEGER;

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "emailApprovals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailBriefings" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'writing',
    "dataJson" TEXT NOT NULL,
    "text" TEXT,
    "runId" TEXT,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Briefing_organizationId_createdAt_idx" ON "Briefing"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Briefing_organizationId_period_periodStart_key" ON "Briefing"("organizationId", "period", "periodStart");

-- AddForeignKey
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
