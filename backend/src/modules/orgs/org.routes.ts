import { Router } from "express"
import { Role } from "@prisma/client"
import { ok, AppError } from "../../utils/responses"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import {
  createOrgSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  updateOrgSchema,
} from "./org.schemas"
import {
  listUserOrgs,
  createOrg,
  getOrg,
  updateOrg,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "./org.service"
import { auditLog } from "../audit/audit.service"
import { enforceMemberLimit } from "../../billing/seats.service"

import { prisma } from "../../db/prisma"

export const orgRouter = Router()

orgRouter.get(
  "/me/members",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const items = await prisma.membership.findMany({
        where: { orgId: req.orgId! },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      })

      res.json(
        ok({
          items: items.map((m) => ({
            userId: m.userId,
            role: m.role,
            isBillingAdmin: m.isBillingAdmin,
            isCurrentUser: m.userId === req.auth!.userId,
            name: m.user.name,
            email: m.user.email,
          })),
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

orgRouter.patch(
  "/me/members/:userId",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const userId = String(req.params.userId)
      const isBillingAdmin = Boolean(req.body?.isBillingAdmin)

      const member = await prisma.membership.findFirst({
        where: { orgId: req.orgId!, userId },
      })
      if (!member) {
        throw new AppError("NOT_FOUND", "Member not found", 404)
      }

      if (member.role === Role.OWNER && !isBillingAdmin) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Owner billing access cannot be removed",
          400,
        )
      }

      await prisma.membership.update({
        where: { id: member.id },
        data: { isBillingAdmin },
      })

      await auditLog({
        req,
        action: "ORG_MEMBER_BILLING_ADMIN_CHANGE",
        orgId: req.orgId!,
        userId: req.auth!.userId,
        entityType: "Membership",
        entityId: member.id,
        meta: { targetUserId: userId, isBillingAdmin },
      })

      res.json(ok({ ok: true }))
    } catch (e) {
      next(e)
    }
  },
)

orgRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const orgs = await listUserOrgs(req.auth!.userId)
    res.json(
      ok({ items: orgs, page: 1, pageSize: orgs.length, total: orgs.length }),
    )
  } catch (e) {
    next(e)
  }
})

orgRouter.patch(
  "/:orgId",
  requireAuth,
  requireOrgMembership,
  requireRole("OWNER"),
  async (req, res, next) => {
    try {
      const body = updateOrgSchema.parse(req.body)
      const orgId = String(req.params.orgId)
      const org = await updateOrg(orgId, body.name)

      await auditLog({
        req,
        action: "ORG_UPDATE",
        orgId,
        userId: req.auth!.userId,
        entityType: "Organization",
        entityId: org.id,
        meta: { name: org.name, slug: org.slug },
      })

      res.json(ok(org))
    } catch (e: any) {
      if (e?.name === "ZodError")
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      next(e)
    }
  },
)

orgRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = createOrgSchema.parse(req.body)
    const org = await createOrg(req.auth!.userId, body.name)

    await auditLog({
      req,
      action: "ORG_CREATE",
      orgId: org.id,
      userId: req.auth!.userId,
      entityType: "Organization",
      entityId: org.id,
      meta: { name: org.name, slug: org.slug },
    })

    res.json(ok(org))
  } catch (e: any) {
    if (e?.name === "ZodError")
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    next(e)
  }
})

orgRouter.get(
  "/:orgId",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const org = await getOrg(req.orgId!)
      res.json(ok(org))
    } catch (e) {
      next(e)
    }
  },
)

orgRouter.get(
  "/:orgId/members",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const members = await listMembers(req.orgId!)
      res.json(
        ok({
          items: members,
          page: 1,
          pageSize: members.length,
          total: members.length,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

orgRouter.post(
  "/:orgId/members",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const body = addMemberSchema.parse(req.body)
      const role = body.role ?? Role.VIEWER

      await enforceMemberLimit(req.orgId!, req.auth!.userId)

      const membership = await addMember(req.orgId!, body.email, role)

      await auditLog({
        req,
        action: "ORG_MEMBER_ADD",
        orgId: req.orgId!,
        userId: req.auth!.userId,
        entityType: "Membership",
        entityId: membership.id,
        meta: { addedEmail: body.email, role },
      })

      res.json(ok({ membershipId: membership.id }))
    } catch (e: any) {
      if (e?.name === "ZodError")
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      next(e)
    }
  },
)

orgRouter.patch(
  "/:orgId/members/:memberId",
  requireAuth,
  requireOrgMembership,
  requireRole("OWNER"),
  async (req, res, next) => {
    try {
      const body = updateMemberRoleSchema.parse(req.body)
      const updated = await updateMemberRole(
        req.orgId!,
        req.params.memberId,
        body.role,
      )

      await auditLog({
        req,
        action: "ORG_MEMBER_ROLE_CHANGE",
        orgId: req.orgId!,
        userId: req.auth!.userId,
        entityType: "Membership",
        entityId: updated.id,
        meta: { role: updated.role },
      })

      res.json(ok({ membershipId: updated.id, role: updated.role }))
    } catch (e: any) {
      if (e?.name === "ZodError")
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      next(e)
    }
  },
)

orgRouter.delete(
  "/:orgId/members/:memberId",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const removed = await removeMember(req.orgId!, req.params.memberId)

      await auditLog({
        req,
        action: "ORG_MEMBER_REMOVE",
        orgId: req.orgId!,
        userId: req.auth!.userId,
        entityType: "Membership",
        entityId: removed.id,
        meta: { removedUserId: removed.userId },
      })

      res.json(ok({}))
    } catch (e) {
      next(e)
    }
  },
)
