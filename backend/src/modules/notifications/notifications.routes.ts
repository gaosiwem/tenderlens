import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { requireSystemAdmin } from "../../middleware/admin.middleware"
import { prisma } from "../../db/prisma"
import { ok, AppError } from "../../utils/responses"
import { Prisma, DeliveryStatus } from "@prisma/client"
import { deliveryQueue } from "../../queues/delivery.queue"
import crypto from "crypto"

export const notificationsRouter = Router()

async function getUserDeliveryAddressFilters(args: {
  userId: string
  orgId: string
}) {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { email: true },
  })

  const prefs = await prisma.userNotificationPrefs.findFirst({
    where: { userId: args.userId, orgId: args.orgId },
    select: { whatsappNumber: true, whatsappVerifiedAt: true },
  })

  const filters: Array<{ channel: string; to: string }> = []

  if (user?.email) {
    filters.push({ channel: "email", to: user.email })
  }

  if (prefs?.whatsappNumber && prefs.whatsappVerifiedAt) {
    filters.push({ channel: "whatsapp", to: prefs.whatsappNumber })
  }

  return filters
}

async function listPersonalEvents(args: {
  orgId: string
  userId: string
  take: number
}) {
  const addressFilters = await getUserDeliveryAddressFilters({
    orgId: args.orgId,
    userId: args.userId,
  })

  const eventIdsFromDeliveries = addressFilters.length
    ? await prisma.notificationDelivery.findMany({
        where: {
          orgId: args.orgId,
          OR: addressFilters.map((f) => ({ channel: f.channel, to: f.to })),
        },
        select: { eventId: true },
      })
    : []

  const uniqueEventIds = Array.from(
    new Set(eventIdsFromDeliveries.map((row) => row.eventId)),
  )

  const eventFilters: Prisma.NotificationEventWhereInput[] = [
    { meta: { path: ["toUserId"], equals: args.userId } },
  ]

  if (uniqueEventIds.length > 0) {
    eventFilters.push({ id: { in: uniqueEventIds } })
  }

  return prisma.notificationEvent.findMany({
    where: {
      orgId: args.orgId,
      OR: eventFilters,
    },
    orderBy: { createdAt: "desc" },
    take: args.take,
  })
}

async function listPersonalDeliveries(args: {
  orgId: string
  userId: string
  take: number
}) {
  const addressFilters = await getUserDeliveryAddressFilters({
    orgId: args.orgId,
    userId: args.userId,
  })

  if (!addressFilters.length) return []

  return prisma.notificationDelivery.findMany({
    where: {
      orgId: args.orgId,
      OR: addressFilters.map((f) => ({ channel: f.channel, to: f.to })),
    },
    orderBy: { createdAt: "desc" },
    take: args.take,
  })
}

notificationsRouter.get(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const take = Math.min(200, Number(req.query.take ?? "50"))
      const items = await listPersonalEvents({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        take,
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

notificationsRouter.get(
  "/events",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const take = Math.min(200, Number(req.query.take ?? "50"))
      const items = await listPersonalEvents({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        take,
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

notificationsRouter.get(
  "/deliveries",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const take = Math.min(200, Number(req.query.take ?? "50"))
      const items = await listPersonalDeliveries({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        take,
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

notificationsRouter.get(
  "/admin/events",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const take = Math.min(500, Number(req.query.take ?? "100"))
      const orgIdFilter = String(req.query.orgId ?? "").trim()
      const where: Prisma.NotificationEventWhereInput = {}
      if (orgIdFilter) where.orgId = orgIdFilter

      const items = await prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

notificationsRouter.get(
  "/admin/deliveries",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const take = Math.min(500, Number(req.query.take ?? "100"))
      const orgIdFilter = String(req.query.orgId ?? "").trim()
      const statusFilter = String(req.query.status ?? "")
        .trim()
        .toUpperCase()
      const channelFilter = String(req.query.channel ?? "")
        .trim()
        .toLowerCase()

      const where: Prisma.NotificationDeliveryWhereInput = {}
      if (orgIdFilter) where.orgId = orgIdFilter
      if (statusFilter) {
        const allowedStatuses = new Set(["PENDING", "SENT", "FAILED"])
        if (!allowedStatuses.has(statusFilter)) {
          throw new AppError(
            "VALIDATION_ERROR",
            "status must be one of: PENDING, SENT, FAILED",
            400,
          )
        }
        where.status = statusFilter as DeliveryStatus
      }
      if (channelFilter) where.channel = channelFilter

      const items = await prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

notificationsRouter.post(
  "/admin/manual-send",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const to = String(req.body?.to ?? "").trim()
      if (!to) {
        throw new AppError("VALIDATION_ERROR", "Recipient email is required", 400)
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(to)) {
        throw new AppError("VALIDATION_ERROR", "Recipient email is invalid", 400)
      }

      const kind = String(req.body?.kind ?? "WATCHLIST_REMINDER").trim()
      const tenderTitle = String(
        req.body?.tenderTitle ?? "Manual Notification Test",
      ).trim()
      const companyName = String(req.body?.companyName ?? "TenderLens").trim()
      const reminderType = String(req.body?.reminderType ?? "CLOSING_24H").trim()
      const manualMessage = String(
        req.body?.message ?? "Manual admin-triggered email",
      ).trim()

      const closingDateRaw = String(req.body?.closingDate ?? "").trim()
      const closingDate = closingDateRaw
        ? new Date(closingDateRaw)
        : new Date(Date.now() + 2 * 60 * 60 * 1000)
      if (Number.isNaN(closingDate.getTime())) {
        throw new AppError("VALIDATION_ERROR", "closingDate is invalid", 400)
      }

      const event = await prisma.notificationEvent.create({
        data: {
          orgId: req.orgId!,
          type: "ALERT_FIRED",
          entityType: "System",
          entityId: `manual-email-${Date.now()}`,
          meta: {
            kind,
            toUserId: req.auth!.userId,
            tenderId: "manual-email",
            tenderTitle,
            companyName,
            closingDate: closingDate.toISOString(),
            reminderType,
            manualMessage,
          },
        },
      })

      const delivery = await prisma.notificationDelivery.create({
        data: {
          orgId: req.orgId!,
          eventId: event.id,
          channel: "email",
          to,
          status: "PENDING",
          idempotencyKey: `${event.id}:email:${to}:${crypto.randomUUID()}`,
        },
      })

      await deliveryQueue.add("deliver", { id: delivery.id })

      res.json(
        ok({
          eventId: event.id,
          deliveryId: delivery.id,
          status: delivery.status,
          to: delivery.to,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)
