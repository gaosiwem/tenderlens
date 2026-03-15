import { prisma } from "../db/prisma"
import { getExperimentBucket } from "./experiments.service"

export async function resolveExperimentsForOrg(orgId: string) {
  if (process.env.EXPERIMENT_TARGETING_ENABLED !== "true") return []

  const sub = await prisma.orgSubscription.findUnique({ where: { orgId } })
  const day = new Date().toISOString().slice(0, 10)
  const seg = await prisma.orgSegmentSnapshot.findUnique({
    where: {
      orgId_day: {
        orgId,
        day,
      },
    },
  })

  const configs = await prisma.experimentConfig.findMany({
    where: { enabled: true },
    take: 50,
  })
  const out: any[] = []

  for (const c of configs) {
    const assign = await getExperimentBucket(orgId, c.key)
    // Optional: config can contain targeting rules
    const rules = (c.config as any)?.targeting ?? {}
    if (!matches(rules, sub, seg)) continue

    out.push({
      key: c.key,
      bucket: assign.bucket,
      config: c.config,
    })
  }

  return out
}

function matches(rules: any, sub: any, seg: any) {
  if (!rules) return true
  if (rules.plans?.length && sub && !rules.plans.includes(sub.plan))
    return false
  if (rules.statuses?.length && sub && !rules.statuses.includes(sub.status))
    return false
  if (rules.segments?.length && seg && !rules.segments.includes(seg.segment))
    return false
  return true
}
