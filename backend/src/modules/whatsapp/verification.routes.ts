import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { startVerification, verifyOtp } from "./verification.service"

export const smsVerificationRouter = Router()

smsVerificationRouter.post(
  "/start",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const phoneNumber = String(
        req.body?.phoneNumber ?? req.body?.whatsappNumber ?? "",
      ).trim()
      if (!phoneNumber) {
        throw new AppError("VALIDATION_ERROR", "phoneNumber required", 400)
      }
      const out = await startVerification({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        whatsappNumber: phoneNumber,
      })
      res.json(
        ok({
          verificationId: out.verificationId,
          expiresAt: out.expiresAt,
          phoneNumber,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

smsVerificationRouter.post(
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
