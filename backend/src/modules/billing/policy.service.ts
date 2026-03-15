import { prisma } from "../../db/prisma"

export async function ensureOrgBillingPolicy(orgId: string) {
  const existing = await prisma.orgBillingPolicy.findUnique({
    where: { orgId },
  })
  if (existing) return existing

  return prisma.orgBillingPolicy.create({
    data: { orgId },
  })
}
