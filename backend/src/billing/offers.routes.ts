import { Router } from "express"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { ok } from "../utils/responses"
import { OfferStatus } from "@prisma/client"

export const offersRouter = Router()

/**
 * List active offers for the organization
 */
offersRouter.get(
  "/",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const offers = await prisma.upgradeOffer.findMany({
        where: {
          orgId: req.orgId!,
          status: OfferStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      })

      res.json(ok({ offers }))
    } catch (e) {
      next(e)
    }
  },
)

/**
 * Track offer interaction (click/dismiss)
 */
offersRouter.post(
  "/:id/event",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const { name, meta } = req.body

      await prisma.offerEvent.create({
        data: {
          offerId: req.params.id,
          orgId: req.orgId!,
          name: name || "CLICK",
          meta: meta || {},
        },
      })

      res.json(ok({ success: true }))
    } catch (e) {
      next(e)
    }
  },
)
