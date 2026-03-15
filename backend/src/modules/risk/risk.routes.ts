import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import { env } from "../../config/env"
import { computeWorkspaceRisk } from "./risk.service"
import { enforceTrial, requirePlanFeature } from "../../billing/plan.middleware"

export const riskRouter = Router()

riskRouter.post(
  "/workspaces/:workspaceId/compute",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "risk")
      if (!env.RISK_SCORING_ENABLED)
        return res.json(ok({ riskScore: 0, riskMeta: { disabled: true } }))
      const workspaceId = String(req.params.workspaceId)
      const out = await computeWorkspaceRisk({ orgId: req.orgId!, workspaceId })
      res.json(
        ok({
          ...out,
          riskScore: out.score,
          riskMeta: out,
        }),
      )
    } catch (e) {
      console.error("Risk Route Error:", e)
      next(e)
    }
  },
)
