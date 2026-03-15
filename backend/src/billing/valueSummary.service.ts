import { prisma } from "../db/prisma"
import { env } from "../config/env"
import { emitEvent } from "../modules/notifications/notifications.service"
import { NotificationType } from "@prisma/client"

export async function sendWeeklyValueSummaries() {
  if (!env.VALUE_SUMMARY_ENABLED) return { sent: 0 }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000)

  const orgs = await prisma.orgSubscription.findMany({
    where: { status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    take: 200,
  })

  let sent = 0
  for (const s of orgs) {
    const events = await prisma.billingEvent.findMany({
      where: { orgId: s.orgId, createdAt: { gte: since } },
      take: 200,
    })

    const usage = await prisma.orgUsage.findFirst({
      where: { orgId: s.orgId },
      orderBy: { month: "desc" },
    })

    await emitEvent({
      orgId: s.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "OrgSubscription",
      entityId: s.orgId,
      meta: { kind: "WEEKLY_VALUE_SUMMARY", eventsCount: events.length, usage },
    })

    sent++
  }

  return { sent }
}
