/*
  Warnings:

  - You are about to drop the column `costCredits` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `costMethod` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the `CreditGrant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditLedger` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditPack` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrgWallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UsageEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CreditGrant" DROP CONSTRAINT "CreditGrant_orgId_fkey";

-- DropForeignKey
ALTER TABLE "CreditLedger" DROP CONSTRAINT "CreditLedger_orgId_fkey";

-- DropForeignKey
ALTER TABLE "CreditLedger" DROP CONSTRAINT "CreditLedger_walletId_fkey";

-- DropForeignKey
ALTER TABLE "OrgWallet" DROP CONSTRAINT "OrgWallet_orgId_fkey";

-- DropForeignKey
ALTER TABLE "UsageEvent" DROP CONSTRAINT "UsageEvent_orgId_fkey";

-- DropForeignKey
ALTER TABLE "UsageEvent" DROP CONSTRAINT "UsageEvent_walletId_fkey";

-- DropIndex
DROP INDEX "BidChecklist_tenderId_key";

-- DropIndex
DROP INDEX "BidWorkspace_tenderId_key";

-- DropIndex
DROP INDEX "UserNotificationPrefs_userId_key";

-- DropIndex
DROP INDEX "WatchlistItem_notificationChannels_idx";

-- DropIndex
DROP INDEX "WatchlistItem_reminderTypes_idx";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "costCredits",
DROP COLUMN "costMethod";

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "amount" TEXT,
ALTER COLUMN "orgId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WatchlistItem" ADD COLUMN     "notes" TEXT;

-- DropTable
DROP TABLE "CreditGrant";

-- DropTable
DROP TABLE "CreditLedger";

-- DropTable
DROP TABLE "CreditPack";

-- DropTable
DROP TABLE "OrgWallet";

-- DropTable
DROP TABLE "UsageEvent";

-- DropEnum
DROP TYPE "LedgerType";

-- DropEnum
DROP TYPE "UsageType";

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "hideClosedTenders" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotificationPrefs_userId_idx" ON "UserNotificationPrefs"("userId");
