import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import { getPrefs, updatePrefs } from "./preferences.service"
import { env } from "../../config/env"

export const preferencesRouter = Router()

preferencesRouter.get(
  "/me",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const prefs = await getPrefs({
        orgId: req.orgId!,
        userId: req.auth!.userId,
      })
      const whatsappCost = env.COST_SMS_NOTIFICATION || 0
      res.json(ok({ prefs, whatsappCost }))
    } catch (e) {
      next(e)
    }
  },
)

preferencesRouter.post(
  "/me",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const prefs = await updatePrefs({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        patch: req.body ?? {},
      })
      res.json(ok({ prefs }))
    } catch (e) {
      next(e)
    }
  },
)
