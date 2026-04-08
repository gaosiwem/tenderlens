import { Worker } from "bullmq"
import { redis } from "../redis/client"
import { prisma } from "../db/prisma"
import { sendEmail } from "../modules/notifications/email.sender"
import { sendSms } from "../modules/notifications/sms.sender"
import { buildNotificationContent } from "../modules/notifications/message.builder"
import { env } from "../config/env"
import { deliveryQueue } from "../queues/delivery.queue"
import { captureBackgroundException } from "../monitoring/sentry"

async function processOne(id: string) {
  const item = await prisma.notificationDelivery.findFirst({ where: { id } })
  if (!item) return

  if (item.status === "SENT") return
  if (item.deferUntil && item.deferUntil > new Date()) {
    // Defensive requeue if a delayed item was picked too early.
    const delay = Math.max(0, item.deferUntil.getTime() - Date.now())
    await deliveryQueue.add("deliver", { id: item.id }, { delay })
    return
  }

  const event = await prisma.notificationEvent.findFirst({
    where: { id: item.eventId },
  })
  const { subject, text, html } = buildNotificationContent(event)

  await prisma.notificationDelivery.update({
    where: { id: item.id },
    data: { attempts: item.attempts + 1, lastAttemptAt: new Date() },
  })

  try {
    if (item.channel === "email") {
      await sendEmail(item.to, subject, text, html)
    } else if (item.channel === "whatsapp" || item.channel === "sms") {
      await sendSms(item.to, text)
    }

    await prisma.notificationDelivery.update({
      where: { id: item.id },
      data: { status: "SENT", sentAt: new Date(), lastError: null },
    })
  } catch (err: any) {
    await prisma.notificationDelivery.update({
      where: { id: item.id },
      data: { status: "FAILED", lastError: err.message },
    })
    throw err // Rethrow for BullMQ retry
  }
}

export function startDeliveryWorker() {
  if (!env.DELIVERY_QUEUE_ENABLED) return

  const worker = new Worker(
    "notificationDelivery",
    async (job) => {
      const id = String(job.data.id)
      await processOne(id)
    },
    {
      connection: redis,
    },
  )

  worker.on("failed", (job, err) => {
    captureBackgroundException(err, {
      service: "worker",
      area: "queue",
      mechanism: "delivery.failed",
      queue: "notificationDelivery",
      jobId: job?.id ? String(job.id) : null,
    })
    console.error(`Delivery job ${job?.id} failed: ${err.message}`)
  })
}
