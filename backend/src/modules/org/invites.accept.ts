import { Router } from "express"
import { prisma } from "../../db/prisma"
import { requireAuth } from "../../middleware/auth.middleware"
import { ok, AppError } from "../../utils/responses"
import { enforceMemberLimit, refreshSeatsUsed } from "../../billing/seats.service"
import { hashPassword, randomToken } from "../../utils/crypto"
import { sendEmail } from "../notifications/email.sender"
import { buildInviteTemporaryPasswordContent } from "../notifications/auth-email.builder"
import { env } from "../../config/env"

function deriveNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? ""
  const normalized = local.replace(/[._-]+/g, " ").trim()
  return normalized.length > 0 ? normalized.slice(0, 120) : null
}

function generateTemporaryPassword() {
  return `${randomToken(6)}Aa1!`
}

async function getInviteOrThrow(token: string) {
  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: {
      org: { select: { id: true, name: true } },
    },
  })

  if (!invite) throw new AppError("NOT_FOUND", "Invite not found", 404)
  if (invite.status !== "PENDING") {
    throw new AppError("INVALID_STATE", "Invite is no longer valid", 400)
  }

  if (new Date() > invite.expiresAt) {
    await prisma.orgInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    })
    throw new AppError("INVITE_EXPIRED", "Invite expired", 400)
  }

  return invite
}

export const inviteAcceptRouter = Router()

inviteAcceptRouter.get("/invites/:token", async (req, res, next) => {
  try {
    const token = String(req.params.token)
    const invite = await getInviteOrThrow(token)
    res.json(
      ok({
        token: invite.token,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        org: invite.org,
      }),
    )
  } catch (e) {
    next(e)
  }
})

inviteAcceptRouter.post(
  "/invites/:token/accept-anonymous",
  async (req, res, next) => {
    try {
      const token = String(req.params.token)
      const invite = await getInviteOrThrow(token)

      const existingUser = await prisma.user.findUnique({
        where: { email: invite.email.toLowerCase() },
        select: { id: true, email: true, passwordHash: true, isActive: true },
      })

      const existingMembership = existingUser
        ? await prisma.membership.findUnique({
            where: {
              userId_orgId: {
                userId: existingUser.id,
                orgId: invite.orgId,
              },
            },
          })
        : null

      if (existingMembership) {
        await prisma.orgInvite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        })

        res.json(
          ok({
            joined: true,
            orgId: invite.orgId,
            provisionalAccountCreated: false,
            email: invite.email,
          }),
        )
        return
      }

      await enforceMemberLimit(invite.orgId, invite.createdBy)

      let temporaryPassword: string | null = null

      await prisma.$transaction(async (tx) => {
        let userId = existingUser?.id ?? null

        if (!userId) {
          temporaryPassword = generateTemporaryPassword()
          const passwordHash = await hashPassword(temporaryPassword)
          const created = await tx.user.create({
            data: {
              email: invite.email.toLowerCase(),
              name: deriveNameFromEmail(invite.email),
              passwordHash,
              mustChangePassword: true,
              emailVerifiedAt: new Date(),
              isActive: true,
            },
            select: { id: true },
          })
          userId = created.id
        }

        await tx.membership.create({
          data: {
            orgId: invite.orgId,
            userId,
            role: invite.role as any,
            isBillingAdmin: false,
          },
        })

        await tx.orgInvite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        })
      })

      await refreshSeatsUsed(invite.orgId)

      if (temporaryPassword) {
        const content = buildInviteTemporaryPasswordContent({
          orgName: invite.org.name,
          loginUrl: `${env.FRONTEND_URL}/auth/login?email=${encodeURIComponent(invite.email)}`,
          temporaryPassword,
        })
        try {
          await sendEmail(invite.email, content.subject, content.text, content.html)
        } catch (err) {
          console.warn("Invite temporary password delivery failed", err)
        }
      }

      res.json(
        ok({
          joined: true,
          orgId: invite.orgId,
          provisionalAccountCreated: Boolean(temporaryPassword),
          email: invite.email,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

inviteAcceptRouter.post(
  "/invites/:token/accept",
  requireAuth,
  async (req, res, next) => {
    try {
      const token = String(req.params.token)
      const invite = await getInviteOrThrow(token)
      const authUser = await prisma.user.findUnique({
        where: { id: req.auth!.userId },
        select: { id: true, email: true },
      })
      if (!authUser) throw new AppError("UNAUTHORIZED", "Invalid user", 401)
      if (authUser.email.toLowerCase() !== invite.email.toLowerCase()) {
        throw new AppError(
          "FORBIDDEN",
          "This invitation belongs to a different email address.",
          403,
        )
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
