-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "capabilitiesJson" TEXT,
ADD COLUMN     "modelTier" TEXT,
ADD COLUMN     "role" TEXT;

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'tool',
ADD COLUMN     "responseText" TEXT;

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "budgetCapCents" DOUBLE PRECISION,
ADD COLUMN     "costCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'task',
ADD COLUMN     "resultJson" TEXT;
