-- CreateEnum
CREATE TYPE "BidDecision" AS ENUM ('PENDING', 'GO', 'NO_GO');

-- AlterTable
ALTER TABLE "BidWorkspace" ADD COLUMN     "decision" "BidDecision" NOT NULL DEFAULT 'PENDING';
