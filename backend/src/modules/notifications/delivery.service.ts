import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { getOrgNotificationRecipients } from "./recipients.service"
import { deliveryQueue } from "../../queues/delivery.queue"
import { isWithinQuietHours, getNextQuietHoursEnd } from "../../utils/time"
import { getEffectivePlanConfig } from "../../billing/effective-plan.service"

export async function enqueueDeliveries(args: {
  orgId: string
  eventId: string
  type: string
  targetUserId?: string
  targetChannels?: Array<"email" | "whatsapp">
  ignoreEventTypePrefs?: boolean
  ignoreChannelPrefs?: boolean
  deferUntil?: Date
}) {
  const { config: cfg } = await getEffectivePlanConfig(args.orgId)
  const whatsappAllowedForPlan = cfg.whatsapp

  const recipients = await getOrgNotificationRecipients(args.orgId)
  if (!recipients.length) return { queued: 0 }

  let queued = 0
  const allowedChannelSet = args.targetChannels
    ? new Set(args.targetChannels)
    : null

  const allChannels: Array<{
    type: string
    to: string
    deferUntil: Date | null
  }> = []

  for (const r of recipients) {
    if (args.targetUserId && r.userId !== args.targetUserId) continue

    const prefs = r.prefs
    if (!prefs && !args.ignoreChannelPrefs) continue

    if (
      !args.ignoreEventTypePrefs &&
      prefs &&
      prefs.eventTypes.length > 0 &&
      !prefs.eventTypes.includes(args.type)
    ) {
      continue
    }

    const quietHoursDeferUntil =
      prefs?.quietStart &&
      prefs?.quietEnd &&
      isWithinQuietHours(prefs.quietStart, prefs.quietEnd)
        ? getNextQuietHoursEnd(prefs.quietEnd)
        : null
    const forcedDeferUntil = args.deferUntil ?? null
    const deferUntil =
      quietHoursDeferUntil && forcedDeferUntil
        ? new Date(
            Math.max(
              quietHoursDeferUntil.getTime(),
              forcedDeferUntil.getTime(),
            ),
          )
        : quietHoursDeferUntil ?? forcedDeferUntil

    const allowEmail = !allowedChannelSet || allowedChannelSet.has("email")
    const allowWhatsApp =
      whatsappAllowedForPlan &&
      (!allowedChannelSet || allowedChannelSet.has("whatsapp"))

    const emailAllowedByPrefs = args.ignoreChannelPrefs
      ? Boolean(r.email)
      : Boolean(prefs?.emailEnabled && r.email)

    if (allowEmail && emailAllowedByPrefs && r.email) {
      allChannels.push({ type: "email", to: r.email, deferUntil })
    }

    const whatsappAllowedByPrefs = args.ignoreChannelPrefs
      ? Boolean(prefs?.whatsappNumber && prefs.whatsappVerifiedAt)
      : Boolean(
          prefs?.whatsappEnabled &&
            prefs.whatsappNumber &&
            prefs.whatsappVerifiedAt,
        )

    if (
      allowWhatsApp &&
      whatsappAllowedByPrefs &&
      prefs?.whatsappNumber
    ) {
      allChannels.push({
        type: "whatsapp",
        to: prefs.whatsappNumber,
        deferUntil,
      })
    }
  }

  if (!allChannels.length) return { queued: 0 }

  // Batch check idempotency
  const keysToCheck = allChannels.map(
    (ch) => `${args.eventId}:${ch.type}:${ch.to}`,
  )
  const existingDeliveries = await prisma.notificationDelivery.findMany({
    where: { idempotencyKey: { in: keysToCheck } },
    select: { idempotencyKey: true },
  })
  const existingKeys = new Set(existingDeliveries.map((d) => d.idempotencyKey))

  for (const ch of allChannels) {
    const idempotencyKey = `${args.eventId}:${ch.type}:${ch.to}`
    if (existingKeys.has(idempotencyKey)) continue

    const delivery = await prisma.notificationDelivery.create({
      data: {
        orgId: args.orgId,
        eventId: args.eventId,
        channel: ch.type,
        to: ch.to,
        status: "PENDING",
        idempotencyKey,
        deferUntil: ch.deferUntil,
      },
    })

    const delay = ch.deferUntil ? ch.deferUntil.getTime() - Date.now() : 0
    await deliveryQueue.add(
      "deliver",
      { id: delivery.id },
      { delay: Math.max(0, delay) },
    )

    queued++
  }

  return { queued }
}

/** @deprecated Use enqueueDeliveries */
export async function enqueueEmailDeliveries(args: {
  orgId: string
  eventId: string
  subject: string
  body: string
}) {
  return enqueueDeliveries({
    orgId: args.orgId,
    eventId: args.eventId,
    type: "ALERT_FIRED",
  })
}
