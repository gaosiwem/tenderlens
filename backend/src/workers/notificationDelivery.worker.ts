import { prisma } from "../db/prisma"
import { sendEmail } from "../modules/notifications/email.sender"
import { sendSms } from "../modules/notifications/sms.sender"
import { buildNotificationContent } from "../modules/notifications/message.builder"
import { env } from "../config/env"

export async function runNotificationDeliveryById(id: string) {
  const item = await prisma.notificationDelivery.findFirst({
    where: { id },
  })
  if (!item) return { processed: 0, reason: "not_found" as const }
  if (item.status !== "PENDING") return { processed: 0, reason: "not_pending" as const }

  const event = await prisma.notificationEvent.findFirst({
    where: { id: item.eventId, orgId: item.orgId },
  })
  const { subject, text, html } = buildNotificationContent(event)

  try {
    await prisma.notificationDelivery.update({
      where: { id: item.id },
      data: { attempts: item.attempts + 1 },
    })

    if (item.channel === "email") {
      await sendEmail(item.to, subject, text, html)
    } else if (item.channel === "whatsapp" || item.channel === "sms") {
      await sendSms(item.to, text)
    }

    await prisma.notificationDelivery.update({
      where: { id: item.id },
      data: { status: "SENT", sentAt: new Date(), lastError: null },
    })
  } catch (e: any) {
    await prisma.notificationDelivery.update({
      where: { id: item.id },
      data: { status: "FAILED", lastError: e?.message ?? "Failed" },
    })
  }

  return { processed: 1 as const }
}

export async function runNotificationDeliveryOnce() {
  const item = await prisma.notificationDelivery.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  })
  if (!item) return { processed: 0 }
  return runNotificationDeliveryById(item.id)
}
