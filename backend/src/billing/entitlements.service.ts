import { prisma } from "../db/prisma"
import { env } from "../config/env"
import { PLAN_CONFIG } from "./plan"
import { emitEvent } from "../modules/notifications/notifications.service"
import { NotificationType } from "@prisma/client"

function shouldCooldown(lastSentAt: Date | null) {
  if (!lastSentAt) return false
  const hours = (Date.now() - lastSentAt.getTime()) / 3600000
  return hours < env.ENTITLEMENT_WARN_COOLDOWN_HOURS
}

export async function runEntitlementWarnings() {
  if (!env.ENTITLEMENT_WARNINGS_ENABLED) return { sent: 0 }
  const month = new Date()
  const keyMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`

  const subs = await prisma.orgSubscription.findMany({ take: 200 })
  let sent = 0

  for (const sub of subs) {
    const cfg = PLAN_CONFIG[sub.plan]
    const usage = await prisma.orgUsage.findUnique({
      where: { orgId_month: { orgId: sub.orgId, month: keyMonth } } as any,
    })

    // AI threshold warnings
    if (cfg.maxAiQueries !== "unlimited" && usage) {
      const ratio = usage.aiQueries / (cfg.maxAiQueries as number)
      if (ratio >= env.ENTITLEMENT_WARN_THRESHOLD) {
        sent += await upsertAndSend(sub.orgId, "AI_QUERIES_80", {
          used: usage.aiQueries,
          limit: cfg.maxAiQueries,
        })
      }
      if (usage.aiQueries >= (cfg.maxAiQueries as number)) {
        sent += await upsertAndSend(sub.orgId, "AI_QUERIES_100", {
          used: usage.aiQueries,
          limit: cfg.maxAiQueries,
        })
      }
    }

    // Seat threshold warnings
    if (cfg.maxMembers === "seats") {
      const used = sub.seatsUsed ?? 0
      const purchased = sub.seatsPurchased ?? 1
      const ratio = purchased > 0 ? used / purchased : 0
      if (ratio >= env.ENTITLEMENT_WARN_THRESHOLD) {
        sent += await upsertAndSend(sub.orgId, "SEATS_80", { used, purchased })
      }
      if (used >= purchased) {
        sent += await upsertAndSend(sub.orgId, "SEATS_100", { used, purchased })
      }
    }
  }

  return { sent }
}

async function upsertAndSend(orgId: string, kind: string, meta: any) {
  const row = await prisma.orgEntitlementWarning.upsert({
    where: { orgId_kind: { orgId, kind } as any },
    create: { orgId, kind, meta, lastSentAt: null },
    update: { meta },
  })

  // If we updated but logic says we should adhere to cooldown if lastSentAt exists
  // Prisma upsert returns the record. If lastSentAt is set, check cooldown.
  // Warning: upsert updates specific fields. If lastSentAt was not updated by upsert (it wasn't in update clause),
  // it retains old value.

  if (row.lastSentAt && shouldCooldown(row.lastSentAt)) return 0

  await prisma.orgEntitlementWarning.update({
    where: { id: row.id },
    data: { lastSentAt: new Date() },
  })

  await emitEvent({
    orgId,
    type: NotificationType.ALERT_FIRED,
    entityType: "OrgSubscription",
    entityId: orgId,
    meta: { kind: "ENTITLEMENT_WARNING", warningKind: kind, ...meta },
  })

  return 1
}
