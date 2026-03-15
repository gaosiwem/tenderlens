import { Router } from "express"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { requireRole } from "../middleware/rbac.middleware"
import { requireSystemAdmin } from "../middleware/admin.middleware"
import { ok } from "../utils/responses"

export const billingAnalyticsRouter = Router()

billingAnalyticsRouter.post(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? "").trim()
      if (!name) {
        return res.json(ok({ ok: true }))
      }

      await prisma.billingEvent.create({
        data: {
          orgId: req.orgId!,
          userId: req.auth!.userId,
          name,
          meta: req.body?.meta ?? null,
        },
      })
      res.json(ok({ ok: true }))
    } catch (e) {
      next(e)
    }
  },
)

/**
 * Global billing event summary for the Command Center
 */
billingAnalyticsRouter.get(
  "/summary",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const days = Number(req.query.days) || 14
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      // Get count of events per day and name
      // This is a bit complex in Prisma grouping, but let's do a simplified version
      // or raw query if needed. Let's try grouping first.

      const events = await prisma.billingEvent.findMany({
        where: {
          createdAt: { gte: since },
        },
        select: {
          name: true,
          createdAt: true,
        },
      })

      // Aggregate in memory for simplicity in MVP
      const dayMap: Record<string, Record<string, number>> = {}

      events.forEach((e) => {
        const day = e.createdAt.toISOString().split("T")[0]
        if (!dayMap[day]) dayMap[day] = {}
        dayMap[day][e.name] = (dayMap[day][e.name] || 0) + 1
      })

      const items: Array<{ day: string; name: string; count: number }> = []
      Object.keys(dayMap)
        .sort()
        .forEach((day) => {
          Object.keys(dayMap[day]).forEach((name) => {
            items.push({
              day,
              name,
              count: dayMap[day][name],
            })
          })
        })

      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)
