import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { ok, AppError } from "../../utils/responses"
import { env } from "../../config/env"
import { trackBillingEvent } from "../../billing/analytics.service"
import { getEffectivePlanConfig } from "../../billing/effective-plan.service"

export const alertsRouter = Router()

async function requireCustomAlertsFeature(args: { orgId: string; userId: string }) {
  const { config: cfg } = await getEffectivePlanConfig(args.orgId)
  if (cfg.customAlertRules) return

  await trackBillingEvent({
    orgId: args.orgId,
    userId: args.userId,
    name: "alerts_limit_hit",
    meta: { reason: "CUSTOM_ALERT_RULES_NOT_IN_PLAN" },
  }).catch(() => undefined)

  throw new AppError(
    "PLAN_UPGRADE_REQUIRED",
    "Custom alert rules are not available on your current plan.",
    403,
    { upgrade: true, limitType: "alerts" },
  )
}

alertsRouter.get(
  "/rules",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req: any, res, next) => {
    try {
      const items = await prisma.alertRule.findMany({
        where: { orgId: req.orgId! },
        orderBy: { updatedAt: "desc" },
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

alertsRouter.post(
  "/rules",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req: any, res, next) => {
    try {
      await requireCustomAlertsFeature({
        orgId: req.orgId!,
        userId: req.auth!.userId,
      })

      const count = await prisma.alertRule.count({
        where: { orgId: req.orgId! },
      })
      if (count >= env.ALERTS_MAX_RULES_PER_ORG)
        throw new AppError("LIMIT", "Max rules reached", 400)

      const name = String(req.body?.name ?? "").trim()
      if (!name) throw new AppError("VALIDATION_ERROR", "Missing name", 400)

      const eventTypes = Array.isArray(req.body?.eventTypes)
        ? req.body.eventTypes.map(String)
        : []
      const tenderId = req.body?.tenderId ? String(req.body.tenderId) : null
      const keywords = Array.isArray(req.body?.keywords)
        ? req.body.keywords.map(String)
        : []
      const cooldownMin = Number(
        req.body?.cooldownMin ?? env.ALERTS_RULE_COOLDOWN_MINUTES,
      )

      const rule = await prisma.alertRule.create({
        data: {
          orgId: req.orgId!,
          name,
          eventTypes,
          tenderId,
          keywords,
          cooldownMin,
        },
      })
      res.json(ok(rule))
    } catch (e) {
      next(e)
    }
  },
)

alertsRouter.patch(
  "/rules/:id",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req: any, res, next) => {
    try {
      await requireCustomAlertsFeature({
        orgId: req.orgId!,
        userId: req.auth!.userId,
      })

      const id = String(req.params.id)
      const rule = await prisma.alertRule.findFirst({
        where: { id, orgId: req.orgId! },
      })
      if (!rule) throw new AppError("NOT_FOUND", "Rule not found", 404)

      const update: any = {}
      if (req.body?.name !== undefined) update.name = String(req.body.name)
      if (req.body?.isEnabled !== undefined)
        update.isEnabled = Boolean(req.body.isEnabled)
      if (req.body?.eventTypes !== undefined)
        update.eventTypes = Array.isArray(req.body.eventTypes)
          ? req.body.eventTypes.map(String)
          : []
      if (req.body?.tenderId !== undefined)
        update.tenderId = req.body.tenderId ? String(req.body.tenderId) : null
      if (req.body?.keywords !== undefined)
        update.keywords = Array.isArray(req.body.keywords)
          ? req.body.keywords.map(String)
          : []
      if (req.body?.cooldownMin !== undefined)
        update.cooldownMin = Number(req.body.cooldownMin)

      const saved = await prisma.alertRule.update({
        where: { id },
        data: update,
      })
      res.json(ok(saved))
    } catch (e) {
      next(e)
    }
  },
)

alertsRouter.delete(
  "/rules/:id",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req: any, res, next) => {
    try {
      await requireCustomAlertsFeature({
        orgId: req.orgId!,
        userId: req.auth!.userId,
      })

      const id = String(req.params.id)
      const rule = await prisma.alertRule.findFirst({
        where: { id, orgId: req.orgId! },
      })
      if (!rule) throw new AppError("NOT_FOUND", "Rule not found", 404)
      await prisma.alertRule.delete({ where: { id } })
      res.json(ok({ deleted: true }))
    } catch (e) {
      next(e)
    }
  },
)
