import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import { listTemplates, applyTemplate } from "./templates.service"

export const templatesRouter = Router()

templatesRouter.get("/", requireAuth, async (req, res) => {
  res.json(ok(await listTemplates()))
})

templatesRouter.post(
  "/apply",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const templateId = String(req.body?.templateId ?? "")
      const out = await applyTemplate({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        templateId,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)
