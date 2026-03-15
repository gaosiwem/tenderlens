import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { prisma } from "../../db/prisma"

export const tenderExtraRouter = Router()

tenderExtraRouter.get(
  "/:tenderId/chunks",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const orgId = req.orgId!
      const tenderId = req.params.tenderId

      const exists = await prisma.tender.findFirst({
        where: { id: tenderId },
      })
      if (!exists) throw new AppError("NOT_FOUND", "Tender not found", 404)

      const items = await prisma.tenderChunk.findMany({
        where: { orgId, tenderId },
        orderBy: [{ tenderFileId: "asc" }, { index: "asc" }],
        select: {
          id: true,
          tenderId: true,
          tenderFileId: true,
          index: true,
          content: true,
          createdAt: true,
        },
      })

      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

tenderExtraRouter.get(
  "/:tenderId/insights",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const orgId = req.orgId!
      const tenderId = req.params.tenderId

      const exists = await prisma.tender.findFirst({
        where: { id: tenderId },
      })
      if (!exists) throw new AppError("NOT_FOUND", "Tender not found", 404)

      const items = await prisma.tenderInsight.findMany({
        where: { orgId, tenderId },
        orderBy: { createdAt: "desc" },
      })

      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)
