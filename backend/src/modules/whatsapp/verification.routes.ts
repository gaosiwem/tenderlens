import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { startVerification, verifyOtp } from "./verification.service"

export const whatsappVerificationRouter = Router()

whatsappVerificationRouter.post(
  "/start",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const whatsappNumber = String(req.body?.whatsappNumber ?? "").trim()
      if (!whatsappNumber) {
        throw new AppError("VALIDATION_ERROR", "whatsappNumber required", 400)
      }
      const out = await startVerification({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        whatsappNumber,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

whatsappVerificationRouter.post(
  "/verify",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const verificationId = String(req.body?.verificationId ?? "").trim()
      const otp = String(req.body?.otp ?? "").trim()

      if (!verificationId || !otp) {
        throw new AppError(
          "VALIDATION_ERROR",
          "verificationId and otp required",
          400,
        )
      }

      const out = await verifyOtp({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        verificationId,
        otp,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)
