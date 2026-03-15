/*
  Warnings:

  - The values [FREE] on the enum `PlanType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlanType_new" AS ENUM ('TRIAL', 'PRO', 'ENTERPRISE');
ALTER TABLE "public"."OrgSubscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "OrgSubscription" ALTER COLUMN "plan" TYPE "PlanType_new" USING ("plan"::text::"PlanType_new");
ALTER TYPE "PlanType" RENAME TO "PlanType_old";
ALTER TYPE "PlanType_new" RENAME TO "PlanType";
DROP TYPE "public"."PlanType_old";
ALTER TABLE "OrgSubscription" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';
COMMIT;

-- AlterTable
ALTER TABLE "OrgSubscription" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';
