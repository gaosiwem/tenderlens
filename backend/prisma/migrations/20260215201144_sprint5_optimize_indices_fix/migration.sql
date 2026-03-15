-- AlterEnum
ALTER TYPE "UsageType" ADD VALUE 'CHAT_REQUEST';

-- DropIndex
DROP INDEX "Conversation_orgId_idx";

-- DropIndex
DROP INDEX "Message_conversationId_idx";

-- CreateIndex
CREATE INDEX "Conversation_orgId_updatedAt_idx" ON "Conversation"("orgId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
