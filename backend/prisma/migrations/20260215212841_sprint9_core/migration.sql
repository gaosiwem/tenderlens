-- AlterTable
ALTER TABLE "NotificationDelivery" ADD COLUMN     "deferUntil" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserNotificationPrefs" ADD COLUMN     "whatsappVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NotificationDelivery_deferUntil_idx" ON "NotificationDelivery"("deferUntil");
