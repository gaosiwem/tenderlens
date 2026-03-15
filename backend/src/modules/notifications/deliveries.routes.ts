import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { ok } from "../../utils/responses"

export const deliveriesRouter = Router()

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
  if (user?.email) filters.push({ channel: "email", to: user.email })
  if (prefs?.whatsappNumber && prefs.whatsappVerifiedAt) {
    filters.push({ channel: "whatsapp", to: prefs.whatsappNumber })
  }
  return filters
}

deliveriesRouter.get(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const take = Math.min(200, Number(req.query.take ?? "50"))
      const addressFilters = await getUserDeliveryAddressFilters({
        orgId: req.orgId!,
        userId: req.auth!.userId,
      })
      const items = addressFilters.length
        ? await prisma.notificationDelivery.findMany({
            where: {
              orgId: req.orgId!,
              OR: addressFilters.map((f) => ({ channel: f.channel, to: f.to })),
            },
            orderBy: { createdAt: "desc" },
            take,
          })
        : []
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)
