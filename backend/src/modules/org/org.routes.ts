import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { ok } from "../../utils/responses"

export const orgRouter = Router()

/**
 * GET /api/v1/orgs/me/members
 * Returns list of members in the current organization for user pickers.
 */
orgRouter.get(
  "/me/members",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const orgId = req.orgId!

      const memberships = await prisma.membership.findMany({
        where: { orgId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })

      res.json(
        ok({
          items: memberships.map((m) => ({
            userId: m.userId,
            role: m.role,
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
