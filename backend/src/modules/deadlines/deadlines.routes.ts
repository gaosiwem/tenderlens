import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { ok, AppError } from "../../utils/responses"
import {
  getDeadlineContactName,
  getOrRefreshDeadlines,
  refreshDeadlines,
} from "./deadlines.service"
import { env } from "../../config/env"

export const deadlinesRouter = Router()

deadlinesRouter.get(
  "/tenders/:tenderId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const tenderId = String(req.params.tenderId)
      const d = await getOrRefreshDeadlines({
        orgId: req.orgId!,
        tenderId,
      })
      const enriched = d
        ? {
            ...d,
            contactName: getDeadlineContactName(d.citations),
          }
        : null
      res.json(ok({ deadlines: enriched }))
    } catch (e) {
      next(e)
    }
  },
)

deadlinesRouter.post(
  "/tenders/:tenderId/refresh",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      if (!env.DEADLINE_EXTRACTION_ENABLED)
        throw new AppError(
          "DEADLINES_DISABLED",
          "Deadline extraction disabled",
          400,
        )
      const tenderId = String(req.params.tenderId)
      const out = await refreshDeadlines({ orgId: req.orgId!, tenderId })
      res.json(ok({ deadlines: out }))
    } catch (e) {
      next(e)
    }
  },
)
