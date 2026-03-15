import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { ok, AppError } from "../../utils/responses"
import {
  compareTenders,
  getBidChecklist,
  generateBidChecklist,
  updateBidChecklist,
} from "./ai.service"
import { requirePlanFeature, enforceTrial } from "../../billing/plan.middleware"
import { incrementUsage } from "../../billing/usage.service"

export const aiRouter = Router()

aiRouter.get(
  "/checklist/:tenderId",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const out = await getBidChecklist({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })
      if (!out) {
        throw new AppError("NOT_FOUND", "Checklist not found", 404)
      }
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

aiRouter.post(
  "/compare",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "compare")
      await incrementUsage(req.orgId!, "aiQueries", req.auth!.userId)

      const { tenderAId, tenderBId } = req.body
      if (!tenderAId || !tenderBId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "tenderAId and tenderBId required",
          400,
        )
      }
      const out = await compareTenders({
        orgId: req.orgId!,
        tenderAId,
        tenderBId,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

aiRouter.patch(
  "/checklist/:tenderId",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "risk")

      const { tenderId } = req.params
      const { items } = req.body || {}

      if (!Array.isArray(items)) {
        throw new AppError("VALIDATION_ERROR", "items must be an array", 400)
      }

      const out = await updateBidChecklist({
        orgId: req.orgId!,
        tenderId,
        items,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

aiRouter.post(
  "/checklist/:tenderId",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "risk")
      await incrementUsage(req.orgId!, "aiQueries", req.auth!.userId)

      const { tenderId } = req.params
      const { force } = req.body || {}
      const out = await generateBidChecklist({
        orgId: req.orgId!,
        tenderId,
        force: !!force,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)
