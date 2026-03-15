/*
  Warnings:

  - You are about to drop the column `action` on the `BidActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `BidActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `BidAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `assigneeId` on the `BidTask` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `BidTask` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `BidTask` table. All the data in the column will be lost.
  - The `status` column on the `BidTask` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `priority` column on the `BidTask` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `content` on the `BidTaskComment` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `BidTaskComment` table. All the data in the column will be lost.
  - The `decision` column on the `BidWorkspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `orgId` to the `BidActivityLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `BidActivityLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `BidActivityLog` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `orgId` to the `BidAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedBy` to the `BidAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `BidTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgId` to the `BidTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `body` to the `BidTaskComment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgId` to the `BidTaskComment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TaskReminderType" AS ENUM ('DUE_SOON', 'OVERDUE', 'BLOCKED', 'ASSIGNED', 'MENTIONED');

-- CreateEnum
CREATE TYPE "AttachmentTargetType" AS ENUM ('WORKSPACE', 'TASK');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('WORKSPACE_CREATED', 'WORKSPACE_UPDATED', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_STATUS_CHANGED', 'TASK_ASSIGNED', 'COMMENT_ADDED', 'ATTACHMENT_ADDED');

-- DropForeignKey
ALTER TABLE "BidActivityLog" DROP CONSTRAINT "BidActivityLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "BidAttachment" DROP CONSTRAINT "BidAttachment_userId_fkey";

-- DropForeignKey
ALTER TABLE "BidTask" DROP CONSTRAINT "BidTask_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "BidTask" DROP CONSTRAINT "BidTask_creatorId_fkey";

-- DropIndex
DROP INDEX "BidTask_assigneeId_idx";

-- DropIndex
DROP INDEX "TenderChangeLog_orgId_idx";

-- AlterTable
ALTER TABLE "BidActivityLog" DROP COLUMN "action",
DROP COLUMN "details",
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "type" "ActivityType" NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BidAttachment" DROP COLUMN "userId",
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "targetType" "AttachmentTargetType" NOT NULL DEFAULT 'WORKSPACE',
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "uploadedBy" TEXT NOT NULL,
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "BidTask" DROP COLUMN "assigneeId",
DROP COLUMN "creatorId",
DROP COLUMN "dueDate",
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'TODO',
DROP COLUMN "priority",
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "BidTaskComment" DROP COLUMN "content",
DROP COLUMN "updatedAt",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BidWorkspace" ADD COLUMN     "createdBy" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "riskMeta" JSONB,
ADD COLUMN     "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
DROP COLUMN "decision",
ADD COLUMN     "decision" TEXT;

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReminderLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TaskReminderType" NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "firedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mention_orgId_idx" ON "Mention"("orgId");

-- CreateIndex
CREATE INDEX "Mention_taskId_idx" ON "Mention"("taskId");

-- CreateIndex
CREATE INDEX "Mention_commentId_idx" ON "Mention"("commentId");

-- CreateIndex
CREATE INDEX "Mention_toUserId_idx" ON "Mention"("toUserId");

-- CreateIndex
CREATE INDEX "TaskReminderLog_orgId_idx" ON "TaskReminderLog"("orgId");

-- CreateIndex
CREATE INDEX "TaskReminderLog_taskId_idx" ON "TaskReminderLog"("taskId");

-- CreateIndex
CREATE INDEX "TaskReminderLog_userId_idx" ON "TaskReminderLog"("userId");

-- CreateIndex
CREATE INDEX "TaskReminderLog_fireAt_idx" ON "TaskReminderLog"("fireAt");

-- CreateIndex
CREATE INDEX "TaskReminderLog_firedAt_idx" ON "TaskReminderLog"("firedAt");

-- CreateIndex
CREATE INDEX "BidActivityLog_orgId_idx" ON "BidActivityLog"("orgId");

-- CreateIndex
CREATE INDEX "BidAttachment_orgId_idx" ON "BidAttachment"("orgId");

-- CreateIndex
CREATE INDEX "BidAttachment_taskId_idx" ON "BidAttachment"("taskId");

-- CreateIndex
CREATE INDEX "BidTask_orgId_idx" ON "BidTask"("orgId");

-- CreateIndex
CREATE INDEX "BidTask_ownerId_idx" ON "BidTask"("ownerId");

-- CreateIndex
CREATE INDEX "BidTask_dueAt_idx" ON "BidTask"("dueAt");

-- CreateIndex
CREATE INDEX "BidTaskComment_orgId_idx" ON "BidTaskComment"("orgId");

-- AddForeignKey
ALTER TABLE "BidTask" ADD CONSTRAINT "BidTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidTask" ADD CONSTRAINT "BidTask_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidAttachment" ADD CONSTRAINT "BidAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidAttachment" ADD CONSTRAINT "BidAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BidTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidActivityLog" ADD CONSTRAINT "BidActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BidTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "BidTaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReminderLog" ADD CONSTRAINT "TaskReminderLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BidTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReminderLog" ADD CONSTRAINT "TaskReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
