import { prisma } from "../../db/prisma"
import { NotificationType } from "@prisma/client"
import { evaluateRulesForEvent } from "../alerts/alerts.service"
import { enqueueDeliveries } from "./delivery.service"
import { dispatchIntegrationWebhooks } from "../business/integrations.dispatch"

export async function emitEvent(args: {
  orgId: string
  type: NotificationType
  entityType?: string
  entityId?: string
  meta?: any
  targetUserId?: string
  targetChannels?: Array<"email" | "whatsapp">
  ignoreEventTypePrefs?: boolean
  ignoreChannelPrefs?: boolean
  deferUntil?: Date
}) {
  const event = await prisma.notificationEvent.create({
    data: {
      orgId: args.orgId,
      type: args.type,
      entityType: args.entityType,
      entityId: args.entityId,
      meta: args.meta,
    },
  })

  // Avoid recursive alert evaluation for ALERT_FIRED itself
  if (args.type !== NotificationType.ALERT_FIRED) {
    // Determine event type for rules engine mapping
    let ruleEventType:
      | "TENDER_CHANGED"
      | "DEADLINE_CHANGED"
      | "SUMMARY_CREATED"
      | null = null

    if (args.type === NotificationType.TENDER_CHANGED)
      ruleEventType = "TENDER_CHANGED"
    else if (args.type === NotificationType.DEADLINE_CHANGED)
      ruleEventType = "DEADLINE_CHANGED"
    else if (args.type === NotificationType.TENDER_SUMMARY_CREATED)
      ruleEventType = "SUMMARY_CREATED"

    if (ruleEventType) {
      await evaluateRulesForEvent({
        orgId: args.orgId,
        eventType: ruleEventType,
        tenderId: args.meta?.tenderId,
        text: args.meta?.summaryContent || args.meta?.changeDescription,
        sourceEventId: event.id,
      })
    }
  }

  // Sprint 9: Queue for delivery immediately for ALL events
  // The service handles preferences internally
  await enqueueDeliveries({
    orgId: args.orgId,
    eventId: event.id,
    type: args.type,
    targetUserId: args.targetUserId ?? args.meta?.toUserId,
    targetChannels: args.targetChannels,
    ignoreEventTypePrefs: args.ignoreEventTypePrefs,
    ignoreChannelPrefs: args.ignoreChannelPrefs,
    deferUntil: args.deferUntil,
  })

  void dispatchIntegrationWebhooks({
    orgId: args.orgId,
    event: {
      id: event.id,
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      meta: event.meta,
      createdAt: event.createdAt,
    },
  }).catch(() => undefined)

  return event
}
