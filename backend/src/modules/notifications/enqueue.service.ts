import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { getRecipientsForChannel } from "./prefsRecipients.service"

export async function enqueueDeliveries(args: {
  orgId: string
  eventId: string
  eventType: string
  subject: string
  body: string
}) {
  let queued = 0

  const emailRecipients = await getRecipientsForChannel({
    orgId: args.orgId,
    channel: "email",
    eventType: args.eventType,
  })

  if (emailRecipients.length > 0) {
    await prisma.notificationDelivery.createMany({
      data: emailRecipients.map((r) => ({
        orgId: args.orgId,
        eventId: args.eventId,
        channel: "email",
        to: r.to,
        status: "PENDING",
      })),
    })
    queued += emailRecipients.length
  }

  if (env.WHATSAPP_ENABLED) {
    const waRecipients = await getRecipientsForChannel({
      orgId: args.orgId,
      channel: "whatsapp",
      eventType: args.eventType,
    })
    if (waRecipients.length > 0) {
      await prisma.notificationDelivery.createMany({
        data: waRecipients.map((r) => ({
          orgId: args.orgId,
          eventId: args.eventId,
          channel: "whatsapp",
          to: r.to,
          status: "PENDING",
        })),
      })
      queued += waRecipients.length
    }
  }

  return { queued }
}
