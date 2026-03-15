import { Router } from "express"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { ok } from "../utils/responses"
import { getExperimentBucket } from "./experiments.service"

export const experimentsRouter = Router()

experimentsRouter.get(
  "/me",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      // We can accept a 'key' query param or just return common ones?
      // The plan said "GET /api/v1/billing/experiments/me"
      // Let's return a specific one or map of them.
      // For now, let's just return the 'upgrade_prompt_v1' bucket as per plan.

      const key = "upgrade_prompt_v1"
      const assignment = await getExperimentBucket(req.orgId!, key)

      res.json(ok({ [key]: assignment.bucket }))
    } catch (e) {
      next(e)
    }
  },
)
