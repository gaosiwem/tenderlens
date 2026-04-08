import { prisma } from "../db/prisma"

export type BillingEventName =
  | "paywall_shown"
  | "upgrade_clicked"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed"
  | "portal_opened"
  | "member_limit_hit"
  | "watchlist_limit_hit"
  | "ai_limit_hit"
  | "alerts_limit_hit"

/**
 * Tracks a billing-related event for funnel analytics.
 */
export async function trackBillingEvent(params: {
  orgId: string
  userId?: string
  name: BillingEventName
  meta?: any
}) {
  return prisma.billingEvent.create({
    data: {
      orgId: params.orgId,
      userId: params.userId,
      name: params.name,
      meta: params.meta || {},
    },
  })
}

/**
 * Returns a summary of billing events for an organization.
 */
export async function getBillingEventsSummary(orgId: string) {
  const events = await prisma.billingEvent.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  // Basic counters
  const counts = await prisma.billingEvent.groupBy({
    by: ["name"],
    where: { orgId },
    _count: true,
  })

  return {
    items: events,
    summary: counts.reduce(
      (acc, curr) => {
        acc[curr.name] = curr._count
        return acc
      },
      {} as Record<string, number>,
    ),
  }
}
