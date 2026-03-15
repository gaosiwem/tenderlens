-- CreateEnum
CREATE TYPE "BidTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "BidTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReminderType" ADD VALUE 'BRIEFING_SESSION';
ALTER TYPE "ReminderType" ADD VALUE 'SITE_VISIT';
ALTER TYPE "ReminderType" ADD VALUE 'TASK_DUE';

-- CreateTable
CREATE TABLE "BidWorkspace" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "BidTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "BidTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "creatorId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidAttachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidActivityLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BidWorkspace_tenderId_key" ON "BidWorkspace"("tenderId");

-- CreateIndex
CREATE INDEX "BidWorkspace_orgId_idx" ON "BidWorkspace"("orgId");

-- CreateIndex
CREATE INDEX "BidTask_workspaceId_idx" ON "BidTask"("workspaceId");

-- CreateIndex
CREATE INDEX "BidTask_assigneeId_idx" ON "BidTask"("assigneeId");

-- CreateIndex
CREATE INDEX "BidTaskComment_taskId_idx" ON "BidTaskComment"("taskId");

-- CreateIndex
CREATE INDEX "BidAttachment_workspaceId_idx" ON "BidAttachment"("workspaceId");

-- CreateIndex
CREATE INDEX "BidActivityLog_workspaceId_idx" ON "BidActivityLog"("workspaceId");

-- CreateIndex
CREATE INDEX "BidActivityLog_createdAt_idx" ON "BidActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BidWorkspace" ADD CONSTRAINT "BidWorkspace_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidWorkspace" ADD CONSTRAINT "BidWorkspace_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTask" ADD CONSTRAINT "BidTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BidWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTask" ADD CONSTRAINT "BidTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTask" ADD CONSTRAINT "BidTask_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTaskComment" ADD CONSTRAINT "BidTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BidTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTaskComment" ADD CONSTRAINT "BidTaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidAttachment" ADD CONSTRAINT "BidAttachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BidWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidAttachment" ADD CONSTRAINT "BidAttachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidActivityLog" ADD CONSTRAINT "BidActivityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BidWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidActivityLog" ADD CONSTRAINT "BidActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppVerification" ADD CONSTRAINT "WhatsAppVerification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppVerification" ADD CONSTRAINT "WhatsAppVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderReminder" ADD CONSTRAINT "TenderReminder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderReminder" ADD CONSTRAINT "TenderReminder_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderComparison" ADD CONSTRAINT "TenderComparison_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderComparison" ADD CONSTRAINT "TenderComparison_tenderAId_fkey" FOREIGN KEY ("tenderAId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderComparison" ADD CONSTRAINT "TenderComparison_tenderBId_fkey" FOREIGN KEY ("tenderBId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidChecklist" ADD CONSTRAINT "BidChecklist_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidChecklist" ADD CONSTRAINT "BidChecklist_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
