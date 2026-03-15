import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { getTenderSummary, generateTenderSummary } from "./summaries.service"
import { ok } from "../../utils/responses"
import { enforceTrial } from "../../billing/plan.middleware"
import { incrementUsage } from "../../billing/usage.service"

export const summariesRouter = Router()

summariesRouter.get(
  "/:tenderId",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const summary = await getTenderSummary(req.orgId!, req.params.tenderId)
      res.json(ok(summary))
    } catch (e) {
      next(e)
    }
  },
)

summariesRouter.post(
  "/:tenderId/refresh",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await incrementUsage(req.orgId!, "aiQueries", req.auth!.userId)
      const summary = await generateTenderSummary(
        req.orgId!,
        req.params.tenderId,
      )
      res.json(ok(summary))
    } catch (e) {
      next(e)
    }
  },
)
