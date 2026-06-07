import { prisma } from "../db/prisma"
import { env } from "../config/env"
import { emitEvent } from "../modules/notifications/notifications.service"
import { NotificationType } from "@prisma/client"

type TrialTouch =
  | "WELCOME"
  | "DAY3"
  | "DAY10"
  | "EXPIRY_72H"
  | "EXPIRY_48H"
  | "EXPIRY_24H"
  | "POST_EXPIRY_DAY1"
  | "POST_EXPIRY_DAY7"

export async function runTrialCampaigns(now = new Date()) {
  if (!env.TRIAL_CAMPAIGNS_ENABLED) return { queued: 0 }

  const subs = await prisma.orgSubscription.findMany({
    where: { status: { in: ["TRIALING", "EXPIRED"] } },
  })

  let queued = 0
  for (const sub of subs) {
    // For MVP, directly emit notifications as events.
    // For production, enqueue per-org jobs and store a "sent table" to avoid duplicates.
    const trialEnds = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null
    if (!trialEnds) continue

    const msToEnd = trialEnds.getTime() - now.getTime()
    const hoursToEnd = msToEnd / 3600000

    if (sub.status === "TRIALING") {
      if (hoursToEnd <= 72 && hoursToEnd > 48) {
        queued += await emitTouch(sub.orgId, "EXPIRY_72H", {
          hoursToEnd: Math.round(hoursToEnd),
          trialEndsAt: trialEnds.toISOString(),
        })
      }

      if (hoursToEnd <= 48 && hoursToEnd > 24) {
        queued += await emitTouch(sub.orgId, "EXPIRY_48H", {
          hoursToEnd: Math.round(hoursToEnd),
          trialEndsAt: trialEnds.toISOString(),
        })
      }

      if (hoursToEnd <= 24 && hoursToEnd > 0) {
        queued += await emitTouch(sub.orgId, "EXPIRY_24H", {
          hoursToEnd: Math.round(hoursToEnd),
          trialEndsAt: trialEnds.toISOString(),
        })
      }
    }

    if (sub.status === "EXPIRED") {
      // simple post expiry nudges based on updatedAt as a proxy
      const daysSince =
        (now.getTime() - sub.updatedAt.getTime()) / (24 * 3600000)
      if (Math.round(daysSince) === env.TRIAL_POST_EXPIRY_DAY1)
        queued += await emitTouch(sub.orgId, "POST_EXPIRY_DAY1", {})
      if (Math.round(daysSince) === env.TRIAL_POST_EXPIRY_DAY7)
        queued += await emitTouch(sub.orgId, "POST_EXPIRY_DAY7", {})
    }
  }

  return { queued }
}

async function emitTouch(orgId: string, touch: TrialTouch, meta: any) {
  const existing = await prisma.notificationEvent.findFirst({
    where: {
      orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "OrgSubscription",
      entityId: orgId,
      meta: { path: ["touch"], equals: touch },
    },
    select: { id: true },
  })
  if (existing) return 0

  await emitEvent({
    orgId,
    type: NotificationType.ALERT_FIRED,
    entityType: "OrgSubscription",
    entityId: orgId,
    meta: { kind: "TRIAL_CAMPAIGN", touch, ...meta },
    targetChannels: ["email"],
    ignoreEventTypePrefs: true,
    ignoreChannelPrefs: true,
  })
  return 1
}
