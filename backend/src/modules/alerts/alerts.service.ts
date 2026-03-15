import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { NotificationType } from "@prisma/client"
import { emitEvent } from "../notifications/notifications.service"
import { getAlertAutomationForOrg } from "../business/business.service"

function now() {
  return new Date()
}

function minutesFrom(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000)
}

function containsKeywords(text: string, keywords: string[]) {
  if (!keywords.length) return true
  const t = text.toLowerCase()
  return keywords.every((k) => t.includes(k.toLowerCase()))
}

export async function evaluateRulesForEvent(args: {
  orgId: string
  eventType: "TENDER_CHANGED" | "DEADLINE_CHANGED" | "SUMMARY_CREATED"
  tenderId?: string
  text?: string
  sourceEventId: string
}) {
  if (!env.ALERTS_ENABLED) return { fired: 0 }
  const automation = await getAlertAutomationForOrg(args.orgId)

  const rules = await prisma.alertRule.findMany({
    where: {
      orgId: args.orgId,
      isEnabled: true,
    },
  })

  let fired = 0
  const body = args.text ?? ""

  for (const r of rules) {
    if (r.tenderId && args.tenderId && r.tenderId !== args.tenderId) continue

    // rule.eventTypes is String[], eventType is enum-like string
    if (r.eventTypes.length > 0 && !r.eventTypes.includes(args.eventType))
      continue

    const cooldownMin = r.cooldownMin ?? env.ALERTS_RULE_COOLDOWN_MINUTES
    if (r.lastFiredAt) {
      const allowedAfter = minutesFrom(r.lastFiredAt, cooldownMin)
      if (allowedAfter > now()) continue
    }

    if (!containsKeywords(body, r.keywords ?? [])) continue

    await prisma.alertRule.update({
      where: { id: r.id },
      data: { lastFiredAt: now() },
    })
    fired += 1

    const targetChannels =
      automation?.alertAutomationEnabled &&
      automation.defaultChannels.length > 0
        ? automation.defaultChannels
        : undefined

    await emitEvent({
      orgId: args.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "AlertRule",
      entityId: r.id,
      targetChannels,
      meta: {
        matchedEventType: args.eventType,
        tenderId: args.tenderId ?? null,
        sourceEventId: args.sourceEventId,
      },
    })

    if (
      automation?.alertAutomationEnabled &&
      automation.alertEscalationEnabled &&
      automation.escalationChannels.length > 0
    ) {
      const deferUntil = new Date(
        Date.now() + automation.alertEscalationMinutes * 60_000,
      )
      await emitEvent({
        orgId: args.orgId,
        type: NotificationType.ALERT_FIRED,
        entityType: "AlertRule",
        entityId: r.id,
        targetChannels: automation.escalationChannels,
        deferUntil,
        ignoreEventTypePrefs: true,
        meta: {
          matchedEventType: args.eventType,
          tenderId: args.tenderId ?? null,
          sourceEventId: args.sourceEventId,
          escalation: true,
          escalationMinutes: automation.alertEscalationMinutes,
        },
      })
    }
  }

  return { fired }
}
