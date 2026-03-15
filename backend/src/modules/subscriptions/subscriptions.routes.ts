import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { startSubscriptionCheckout } from "./subscriptions.service"

export const subscriptionsRouter = Router()

subscriptionsRouter.post(
  "/checkout",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req: any, res, next) => {
    try {
      const planCode = String(req.body?.planCode ?? "")
      if (!["starter", "growth"].includes(planCode)) {
        throw new AppError("VALIDATION_ERROR", "Invalid planCode", 400)
      }

      const successUrl = String(req.body?.successUrl ?? "")
      const cancelUrl = String(req.body?.cancelUrl ?? "")
      if (!successUrl || !cancelUrl) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Missing success or cancel URLs",
          400,
        )
      }

      const out = await startSubscriptionCheckout({
        orgId: req.orgId!,
        planCode: planCode as any,
        successUrl,
        cancelUrl,
      })

      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)
