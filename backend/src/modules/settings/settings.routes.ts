import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireSystemAdmin } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import { getSystemSettings, updateSystemSettings } from "./settings.service"

export const settingsRouter = Router()

settingsRouter.get(
  "/",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const settings = await getSystemSettings()
      res.json(ok(settings))
    } catch (e) {
      next(e)
    }
  },
)

settingsRouter.patch(
  "/",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const settings = await updateSystemSettings(req.body ?? {})
      res.json(ok(settings))
    } catch (e) {
      next(e)
    }
  },
)
