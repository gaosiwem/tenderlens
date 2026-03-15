import { Router } from "express"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { ok } from "../utils/responses"

export const onboardingRouter = Router()

/**
 * Get onboarding checklist with completion status
 */
onboardingRouter.get(
  "/checklist",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const items = await prisma.onboardingChecklistItem.findMany({
        orderBy: { order: "asc" },
      })

      const progress = await prisma.onboardingChecklistProgress.findMany({
        where: { orgId: req.orgId! },
      })

      const map = new Map(progress.map((p) => [p.itemKey, p]))

      res.json(
        ok({
          items: items.map((i) => ({
            key: i.key,
            title: i.title,
            description: i.description,
            completed: Boolean(map.get(i.key)?.completed),
            completedAt: map.get(i.key)?.completedAt ?? null,
          })),
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

/**
 * Mark a checklist item as complete
 * Idempotent - safe to call multiple times
 */
onboardingRouter.post(
  "/checklist/:itemKey/complete",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const itemKey = String(req.params.itemKey)

      await prisma.onboardingChecklistProgress.upsert({
        where: { orgId_itemKey: { orgId: req.orgId!, itemKey } as any },
        create: {
          orgId: req.orgId!,
          itemKey,
          completed: true,
          completedAt: new Date(),
        },
        update: { completed: true, completedAt: new Date() },
      })

      res.json(ok({ completed: true }))
    } catch (e) {
      next(e)
    }
  },
)
