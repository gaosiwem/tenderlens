import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { ok } from "../../utils/responses"

export const timelineRouter = Router()

timelineRouter.get(
  "/tenders/:tenderId/timeline",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const tenderId = String(req.params.tenderId)
      const take = Math.min(200, Number(req.query.take ?? "50"))
      const items = await prisma.tenderChangeLog.findMany({
        where: { orgId: req.orgId!, tenderId },
        orderBy: { createdAt: "desc" },
        take,
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)
