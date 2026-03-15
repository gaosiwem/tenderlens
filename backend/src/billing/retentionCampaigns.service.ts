import { prisma } from "../db/prisma"
import { emitEvent } from "../modules/notifications/notifications.service"
import { NotificationType } from "@prisma/client"

/**
 * Run targeted retention campaigns based on segment classification
 * Sends notifications to orgs in specific segments
 */
export async function runRetentionCampaigns() {
  if (process.env.RETENTION_CAMPAIGNS_ENABLED !== "true") {
    return { sent: 0 }
  }

  const day = new Date().toISOString().slice(0, 10)
  const snaps = await prisma.orgSegmentSnapshot.findMany({
    where: { day },
    take: 200,
  })

  let sent = 0

  for (const s of snaps) {
    const kind =
      s.segment === "TRIAL_HIGH_INTENT"
        ? "RETENTION_TRIAL_HIGH_INTENT"
        : s.segment === "TRIAL_PAYWALL_HIT"
          ? "RETENTION_TRIAL_PAYWALL"
          : s.segment === "PRO_LOW_USAGE"
            ? "RETENTION_PRO_LOW_USAGE"
            : s.segment === "EXPIRED_REACTIVATION"
              ? "RETENTION_EXPIRED"
              : null

    if (!kind) continue

    await emitEvent({
      orgId: s.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "OrgSubscription",
      entityId: s.orgId,
      meta: { kind, segment: s.segment, score: s.score },
    })

    sent++
  }

  return { sent }
}
