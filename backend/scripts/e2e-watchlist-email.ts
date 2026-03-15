import request from "supertest"
import { createApp } from "../src/app"
import { prisma } from "../src/db/prisma"
import { fireReminderById } from "../src/modules/deadlines/reminders.service"
import { runNotificationDeliveryById } from "../src/workers/notificationDelivery.worker"
import { buildNotificationContent } from "../src/modules/notifications/message.builder"
import { signAccessToken } from "../src/utils/jwt"

async function main() {
  const ts = Date.now()
  const app = createApp()

  const email = `watchlist-e2e-${ts}@example.com`
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "e2e-placeholder-hash",
      name: "Watchlist E2E",
    },
    select: { id: true, email: true },
  })

  const org = await prisma.organization.create({
    data: {
      name: `Watchlist E2E Org ${ts}`,
      slug: `watchlist-e2e-${ts}`,
    },
    select: { id: true },
  })

  await prisma.membership.create({
    data: {
      userId: user.id,
      orgId: org.id,
      role: "OWNER",
    },
  })

  const orgId = org.id
  const accessToken = signAccessToken(user.id)

  const tender = await prisma.tender.create({
    data: {
      orgId,
      createdByUserId: user.id,
      title: `E2E Watchlist Tender ${ts}`,
      source: "E2E",
      status: "COMPLETED",
      companyName: "TenderLens QA",
      closingDate: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    },
    select: { id: true, title: true },
  })

  await prisma.tenderDeadline.create({
    data: {
      orgId,
      tenderId: tender.id,
      closingAt: new Date(Date.now() + 24 * 60 * 60_000),
      confidence: 0.99,
    },
  })

  const watchRes = await request(app)
    .post(`/api/v1/watchlist/${tender.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .set("x-org-id", orgId)
    .send({})

  if (watchRes.status >= 400) {
    throw new Error(`Watchlist add failed: ${watchRes.status} ${JSON.stringify(watchRes.body)}`)
  }

  const reminder = await prisma.tenderReminder.create({
    data: {
      orgId,
      tenderId: tender.id,
      type: "CLOSING_24H",
      fireAt: new Date(Date.now() - 1_000),
    },
    select: { id: true },
  })

  await fireReminderById(reminder.id)

  const recentEvents = await prisma.notificationEvent.findMany({
    where: {
      orgId,
      type: "ALERT_FIRED",
      entityId: tender.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const event =
    recentEvents.find((e) => {
      const m = (e.meta ?? {}) as Record<string, unknown>
      return (
        (m.kind === "WATCHLIST_REMINDER" ||
          m.kind === "WATCHLIST_BATCH_SUMMARY") &&
        m.tenderId === tender.id &&
        m.toUserId === user.id
      )
    }) ?? null

  if (!event)
    throw new Error("No WATCHLIST_REMINDER/WATCHLIST_BATCH_SUMMARY event created")

  const delivery = await prisma.notificationDelivery.findFirst({
    where: {
      eventId: event.id,
      channel: "email",
      to: user.email,
    },
    orderBy: { createdAt: "desc" },
  })

  if (!delivery) throw new Error("No email delivery row created for reminder event")

  await runNotificationDeliveryById(delivery.id)

  const finalDelivery = await prisma.notificationDelivery.findUnique({
    where: { id: delivery.id },
    select: {
      id: true,
      status: true,
      attempts: true,
      lastError: true,
      sentAt: true,
      channel: true,
      to: true,
      eventId: true,
      createdAt: true,
    },
  })

  const content = buildNotificationContent(event)

  console.log(
    JSON.stringify(
      {
        ok: true,
        orgId,
        userId: user.id,
        tenderId: tender.id,
        reminderId: reminder.id,
        event: {
          id: event.id,
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          createdAt: event.createdAt,
          meta: event.meta,
        },
        delivery: finalDelivery,
        rendered: {
          subject: content.subject,
          text: content.text,
        },
      },
      null,
      2,
    ),
  )

}

;(async () => {
  try {
    await main()
    await prisma.$disconnect()
    process.exit(0)
  } catch (e: any) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: e?.message ?? String(e),
        },
        null,
        2,
      ),
    )
    await prisma.$disconnect()
    process.exit(1)
  }
})()
