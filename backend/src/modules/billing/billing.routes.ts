import { Router } from "express"
import Stripe from "stripe"
import { env } from "../../config/env"
import { prisma } from "../../db/prisma"
import { requireAuth } from "../../middleware/auth.middleware"
import {
  requireOrgMembership,
  optionalOrgMembership,
} from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { auditLog } from "../audit/audit.service"
import { getUsageSummary } from "../../billing/usage.service"
import {
  createCheckoutSession,
  createPortalSession,
} from "../../billing/stripe.service"
import { requireBillingAdmin } from "../../billing/billing-permissions"
import { trackBillingEvent } from "../../billing/analytics.service"

export const billingRouter = Router()

function toClientPlan(plan: string) {
  return plan === "ENTERPRISE" ? "BUSINESS" : plan
}

function stripeClient() {
  if (!env.STRIPE_SECRET_KEY)
    throw new AppError("CONFIG_ERROR", "STRIPE_SECRET_KEY missing", 500)
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any })
}

billingRouter.get(
  "/subscription",
  requireAuth,
  optionalOrgMembership,
  async (req, res, next) => {
    try {
      if (!req.orgId) {
        return res.json(ok({ subscription: null }))
      }
      const sub = await prisma.orgSubscription.findUnique({
        where: { orgId: req.orgId },
      })
      if (!sub) {
        return res.json(ok({ subscription: null }))
      }
      res.json(ok({ subscription: { ...sub, plan: toClientPlan(sub.plan) } }))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.get(
  "/usage",
  requireAuth,
  optionalOrgMembership,
  async (req, res, next) => {
    try {
      if (!req.orgId) {
        return res.json(ok({ usage: null }))
      }
      const summary = await getUsageSummary(req.orgId)
      res.json(ok({ usage: summary }))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.post(
  "/plan-checkout",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      const { plan } = req.body
      if (plan !== "PRO" && plan !== "BUSINESS") {
        throw new AppError("VALIDATION_ERROR", "Invalid plan", 400)
      }

      const requestedQuantity = Number(req.body?.quantity ?? 1)
      if (
        !Number.isFinite(requestedQuantity) ||
        !Number.isInteger(requestedQuantity) ||
        requestedQuantity < 1
      ) {
        throw new AppError("VALIDATION_ERROR", "Invalid quantity", 400)
      }
      if (requestedQuantity !== 1) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Plan checkout quantity must be 1 for PRO and BUSINESS.",
          400,
        )
      }
      const quantity = 1

      // Map plan to price ID
      const priceId =
        plan === "PRO"
          ? env.STRIPE_PRICE_STARTER_MONTHLY
          : env.STRIPE_PRICE_GROWTH_MONTHLY

      if (!priceId || priceId === "price_xxx") {
        throw new AppError("CONFIG_ERROR", "Plan price not configured", 500)
      }

      const checkoutUrl = await createCheckoutSession(
        req.orgId!,
        priceId,
        quantity || 1,
      )

      await trackBillingEvent({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        name: "checkout_started",
        meta: { plan, quantity, priceId },
      })

      res.json(ok({ checkoutUrl }))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.post(
  "/portal",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      const sub = await prisma.orgSubscription.findUnique({
        where: { orgId: req.orgId! },
      })
      if (!sub || !sub.stripeCustomerId) {
        throw new AppError("NOT_FOUND", "Stripe customer not found", 404)
      }

      const portalUrl = await createPortalSession(sub.stripeCustomerId)
      res.json(ok({ portalUrl }))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.post(
  "/events",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const { name, meta } = req.body
      await trackBillingEvent({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        name,
        meta,
      })
      res.json(ok({}))
    } catch (e) {
      next(e)
    }
  },
)

billingRouter.get(
  "/invoices",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      const invoices = await prisma.orgInvoice.findMany({
        where: { orgId: req.orgId! },
        orderBy: { createdAt: "desc" },
      })
      res.json(ok({ items: invoices }))
    } catch (e) {
      next(e)
    }
  },
)
