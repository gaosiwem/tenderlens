import { Router } from "express"
import crypto from "crypto"
import { prisma } from "../../db/prisma"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { env } from "../../config/env"
import { sendEmail } from "../notifications/email.sender"
import { enforceMemberLimit } from "../../billing/seats.service"

export const invitesRouter = Router()

invitesRouter.post(
  "/me/invites",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? "")
        .trim()
        .toLowerCase()
      const role = String(req.body?.role ?? "MEMBER").toUpperCase()

      if (!email) throw new AppError("VALIDATION_ERROR", "Email required", 400)

      // Check if invite exists
      const existing = await prisma.orgInvite.findFirst({
        where: { orgId: req.orgId!, email, status: "PENDING" },
      })

      if (existing) {
        // Renew it? Or just error. For MVP, error.
        // throw new AppError("CONFLICT", "Invite already pending for this email", 409)
        // Or return existing
        res.json(
          ok({
            invite: {
              email: existing.email,
              role: existing.role,
              token: existing.token,
              expiresAt: existing.expiresAt,
            },
          }),
        )
        return
      }

      // Check if user is already member
      const existingMember = await prisma.membership.findFirst({
        where: { orgId: req.orgId!, user: { email } },
      })
      if (existingMember)
        throw new AppError("CONFLICT", "User is already a member", 409)

      // Enforce member caps before creating a new pending invite
      await enforceMemberLimit(req.orgId!, req.auth!.userId)

      const token = crypto.randomBytes(24).toString("hex")
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const invite = await prisma.orgInvite.create({
        data: {
          orgId: req.orgId!,
          email,
          role: role as any,
          token,
          status: "PENDING",
          createdBy: req.auth!.userId,
          expiresAt,
        },
      })

      const acceptLink = `${env.FRONTEND_URL}/invites/accept/${invite.token}`
      const subject = "You have been invited to join TenderLens"
      const text = [
        "You've been invited to join a TenderLens organization.",
        `Role: ${invite.role}`,
        `Accept link: ${acceptLink}`,
        `Token: ${invite.token}`,
        `Expires: ${invite.expiresAt.toISOString()}`,
      ].join("\n")
      const html = `<p>You've been invited to join a TenderLens organization.</p>
<p><strong>Role:</strong> ${invite.role}</p>
<p><a href="${acceptLink}">Accept invitation</a></p>
<p>If the button does not work, use this token: <code>${invite.token}</code></p>`

      try {
        await sendEmail(email, subject, text, html)
      } catch (err) {
        console.error("Invite email delivery failed", err)
      }

      res.json(
        ok({
          invite: {
            email: invite.email,
            role: invite.role,
            token: invite.token,
            expiresAt: invite.expiresAt,
          },
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)
