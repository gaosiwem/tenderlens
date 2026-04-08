import { OfferStatus } from "@prisma/client"
import { prisma } from "../db/prisma"

export async function generateUpgradeOffers() {
  if (process.env.UPGRADE_OFFERS_ENABLED !== "true") return { created: 0 }

  const windowMin = Number(process.env.UPGRADE_OFFER_SPIKE_WINDOW_MIN ?? 60)
  const since = new Date(Date.now() - windowMin * 60_000)

  // Target TRIAL orgs specifically for expansion
  const orgs = await prisma.orgSubscription.findMany({
    where: {
      plan: "TRIAL" as any,
      status: { in: ["TRIALING", "ACTIVE"] },
    },
    take: 300,
  })

  let createdCount = 0
  for (const s of orgs) {
    const events = await prisma.billingEvent.findMany({
      where: {
        orgId: s.orgId,
        createdAt: { gte: since },
      },
      take: 500,
    })
    const aiQueries = events.filter((e) => e.name === "ai_query").length
    const paywalls = events.filter((e) => e.name === "paywall_shown").length

    const aiThresh = Number(process.env.UPGRADE_OFFER_SPIKE_AI_THRESHOLD ?? 30)
    const pwThresh = Number(
      process.env.UPGRADE_OFFER_SPIKE_PAYWALL_THRESHOLD ?? 3,
    )

    if (aiQueries >= aiThresh) {
      createdCount += await upsertOffer(
        s.orgId,
        "SPIKE_AI",
        "You’re using TenderLens heavily",
        "Upgrade to keep your momentum with higher AI limits and exports.",
        "Upgrade",
        Number(process.env.UPGRADE_OFFER_EXPIRY_HOURS ?? 24),
      )
    }
    if (paywalls >= pwThresh) {
      createdCount += await upsertOffer(
        s.orgId,
        "SPIKE_PAYWALL",
        "Unlock the features you’re trying to use",
        "Pro unlocks workspace, exports, compare, and SMS alerts.",
        "View plans",
        Number(process.env.UPGRADE_OFFER_EXPIRY_HOURS ?? 24),
      )
    }
  }

  return { created: createdCount }
}

async function upsertOffer(
  orgId: string,
  key: string,
  title: string,
  description: string,
  ctaLabel: string,
  expiryHours: number,
) {
  const existing = await prisma.upgradeOffer.findFirst({
    where: {
      orgId,
      key,
      status: OfferStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
  })
  if (existing) return 0

  const expiresAt = new Date(Date.now() + expiryHours * 3600000)
  await prisma.upgradeOffer.create({
    data: {
      orgId,
      key,
      title,
      description,
      ctaLabel,
      expiresAt,
      meta: {},
    },
  })
  return 1
}
