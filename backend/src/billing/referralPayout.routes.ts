import { Router } from "express"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { requireRole } from "../middleware/rbac.middleware"
import { ok, AppError } from "../utils/responses"

export const referralPayoutRouter = Router()

/**
 * Mark a referral earning as paid (admin only)
 * Manual payout workflow for v1
 */
referralPayoutRouter.post(
  "/payouts/mark-paid",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      if (process.env.REFERRAL_PAYOUTS_ENABLED !== "true") {
        throw new AppError("DISABLED", "Referrals disabled", 400)
      }

      const earningId = String(req.body?.earningId ?? "")
      if (!earningId) {
        throw new AppError("VALIDATION_ERROR", "earningId required", 400)
      }

      const row = await prisma.referralEarning.findFirst({
        where: { id: earningId, orgId: req.orgId! },
      })

      if (!row) {
        throw new AppError("NOT_FOUND", "Earning not found", 404)
      }

      await prisma.referralEarning.update({
        where: { id: row.id },
        data: { status: "PAID", paidAt: new Date() },
      })

      res.json(ok({ paid: true }))
    } catch (e) {
      next(e)
    }
  },
)
