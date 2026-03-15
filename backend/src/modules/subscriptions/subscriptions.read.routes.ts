import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { ok } from "../../utils/responses"

export const subscriptionsReadRouter = Router()

function toClientPlan(plan: string) {
  return plan === "ENTERPRISE" ? "BUSINESS" : plan
}

subscriptionsReadRouter.get(
  "/me",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const sub = await prisma.orgSubscription.findFirst({
        where: { orgId: req.orgId! },
      })
      if (!sub) {
        return res.json(ok({ subscription: null }))
      }
      res.json(ok({ subscription: { ...sub, plan: toClientPlan(sub.plan) } }))
    } catch (e) {
      next(e)
    }
  },
)
