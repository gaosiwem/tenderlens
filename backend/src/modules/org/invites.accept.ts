import { Router } from "express"
import { prisma } from "../../db/prisma"
import { requireAuth } from "../../middleware/auth.middleware"
import { ok, AppError } from "../../utils/responses"
import { enforceMemberLimit } from "../../billing/seats.service"
import { refreshSeatsUsed } from "../../billing/seats.service"

export const inviteAcceptRouter = Router()

inviteAcceptRouter.post(
  "/invites/:token/accept",
  requireAuth,
  async (req, res, next) => {
    try {
      const token = String(req.params.token)
      const invite = await prisma.orgInvite.findUnique({ where: { token } })

      if (!invite) throw new AppError("NOT_FOUND", "Invite not found", 404)
      if (invite.status !== "PENDING")
        throw new AppError("INVALID_STATE", "Invite is no longer valid", 400)

      if (new Date() > invite.expiresAt) {
        await prisma.orgInvite.update({
          where: { id: invite.id },
          data: { status: "EXPIRED" },
        })
        throw new AppError("INVITE_EXPIRED", "Invite expired", 400)
      }

      // Enforce seat limits for the ORG the invite belongs to
      // We must check if the target org has seats available
      await enforceMemberLimit(invite.orgId, req.auth!.userId)

      // Check if user is already in this org (idempotency)
      const existing = await prisma.membership.findUnique({
        where: {
          userId_orgId: { userId: req.auth!.userId, orgId: invite.orgId },
        },
      })

      if (existing) {
        // Already a member, just mark invite accepted
        await prisma.orgInvite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        })
        res.json(
          ok({
            joined: true,
            orgId: invite.orgId,
            message: "Already a member",
          }),
        )
        return
      }

      // Add member
      await prisma.membership.create({
        data: {
          orgId: invite.orgId,
          userId: req.auth!.userId,
          // Match the role type from invite.
          // Note: Prisma Enum mismatch might occur if types generated differently, casting as any to be safe or ensure strict typing
          role: invite.role as any,
          isBillingAdmin: false,
        },
      })

      // Mark invite accepted
      await prisma.orgInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      })

      // Refresh seat counts
      await refreshSeatsUsed(invite.orgId)

      res.json(ok({ joined: true, orgId: invite.orgId }))
    } catch (e) {
      next(e)
    }
  },
)
