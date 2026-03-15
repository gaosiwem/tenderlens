import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import { prisma } from "../../db/prisma"
import { ensureOrgBillingPolicy } from "./policy.service"

export const policyRouter = Router()

policyRouter.get(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const p = await ensureOrgBillingPolicy(req.orgId!)
      res.json(ok(p))
    } catch (e) {
      next(e)
    }
  },
)

policyRouter.post(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const maxChatPerDay = Number(req.body?.maxChatPerDay ?? 200)
      const maxChatCost = Number(req.body?.maxChatCost ?? 30)

      const p = await ensureOrgBillingPolicy(req.orgId!)
      const updated = await prisma.orgBillingPolicy.update({
        where: { id: p.id },
        data: { maxChatPerDay, maxChatCost },
      })

      res.json(ok(updated))
    } catch (e) {
      next(e)
    }
  },
)
