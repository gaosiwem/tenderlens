import { prisma } from "../db/prisma"
import { env } from "../config/env"

function hashBucket(orgId: string) {
  // stable A/B based on simple hash
  let h = 0
  for (let i = 0; i < orgId.length; i++)
    h = (h * 31 + orgId.charCodeAt(i)) >>> 0
  return h % 2 === 0 ? "A" : "B"
}

export async function getExperimentBucket(orgId: string, key: string) {
  if (!env.EXPERIMENTS_ENABLED) return { key, bucket: "A" }

  const existing = await prisma.experimentAssignment.findUnique({
    where: { orgId_key: { orgId, key } } as any,
  })
  if (existing) return existing

  const bucket = hashBucket(orgId)
  return prisma.experimentAssignment.create({ data: { orgId, key, bucket } })
}
