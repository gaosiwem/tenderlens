import { prisma } from "../db/prisma"

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

/**
 * Generate segment snapshots for all organizations
 * Classifies orgs based on activity signals and behavior
 */
export async function generateSegmentSnapshots() {
  if (process.env.SEGMENTATION_ENABLED !== "true") {
    return { created: 0 }
  }

  const day = dayKey()
  const subs = await prisma.orgSubscription.findMany({ take: 300 })

  let created = 0

  for (const s of subs) {
    const segment = await classify(s.orgId, s.plan, s.status)

    await prisma.orgSegmentSnapshot.upsert({
      where: { orgId_day: { orgId: s.orgId, day } as any },
      create: {
        orgId: s.orgId,
        day,
        segment: segment.name,
        score: segment.score,
        meta: segment.meta,
      },
      update: {
        segment: segment.name,
        score: segment.score,
        meta: segment.meta,
      },
    })

    created++
  }

  return { created }
}

/**
 * Classify an organization into a segment based on signals
 */
async function classify(orgId: string, plan: any, status: any) {
  // Pull activity signals from last 7 days
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60_000)
  const events = await prisma.billingEvent.findMany({
    where: { orgId, createdAt: { gte: last7d } },
    take: 200,
  })

  const paywallShown = events.filter((e) => e.name === "paywall_shown").length
  const checkoutStarted = events.filter(
    (e) => e.name === "checkout_started",
  ).length
  const valueMoments = events.filter((e) => e.name.startsWith("value_")).length

  // Segment classification logic
  if (status === "PAST_DUE") {
    return {
      name: "PAST_DUE_GRACE",
      score: 90,
      meta: { paywallShown },
    }
  }

  if (status === "EXPIRED") {
    return {
      name: "EXPIRED_REACTIVATION",
      score: 80,
      meta: { paywallShown, checkoutStarted },
    }
  }

  if (plan === "TRIAL" && status === "TRIALING") {
    if (valueMoments >= 2) {
      return {
        name: "TRIAL_HIGH_INTENT",
        score: 85,
        meta: { valueMoments },
      }
    }
    if (paywallShown >= 1) {
      return {
        name: "TRIAL_PAYWALL_HIT",
        score: 75,
        meta: { paywallShown },
      }
    }
    return {
      name: "TRIAL_EARLY",
      score: 40,
      meta: {},
    }
  }

  if (plan === "PRO" && status === "ACTIVE") {
    if (events.length < 3) {
      return {
        name: "PRO_LOW_USAGE",
        score: 60,
        meta: { events: events.length },
      }
    }
    return {
      name: "PRO_ENGAGED",
      score: 30,
      meta: { events: events.length },
    }
  }

  return {
    name: "GENERAL",
    score: 10,
    meta: {},
  }
}
