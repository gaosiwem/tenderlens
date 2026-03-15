import { Router } from "express"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { requireBillingAdmin } from "./billing-permissions"
import { prisma } from "../db/prisma"
import { ok, AppError } from "../utils/responses"
import { stripe } from "./stripe.service"
import { PLAN_CONFIG } from "./plan"
import { env } from "../config/env"

export const inAppBillingRouter = Router()

/**
 * Update seats for existing subscription
 * Requires billing admin permission
 */
inAppBillingRouter.post(
  "/seats/update",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      if (process.env.IN_APP_BILLING_ENABLED !== "true") {
        throw new AppError("DISABLED", "In-app billing disabled", 400)
      }

      const seats = Number(req.body?.seats ?? 1)
      if (!Number.isFinite(seats) || seats < 1 || seats > 500) {
        throw new AppError("VALIDATION_ERROR", "Invalid seat count", 400)
      }

      const sub = await prisma.orgSubscription.findUnique({
        where: { orgId: req.orgId! },
      })

      if (!sub?.stripeSubscriptionId) {
        throw new AppError("NOT_READY", "No Stripe subscription", 400)
      }

      const cfg = PLAN_CONFIG[(sub.plan ?? "TRIAL") as keyof typeof PLAN_CONFIG]
      if (cfg.maxMembers !== "seats") {
        throw new AppError(
          "VALIDATION_ERROR",
          "Seat quantity updates are not available for the current plan model.",
          400,
        )
      }

      const stripeSub = await stripe.subscriptions.retrieve(
        sub.stripeSubscriptionId,
      )
      const itemId = stripeSub.items.data[0]?.id

      if (!itemId) {
        throw new AppError("NOT_READY", "Stripe subscription item missing", 400)
      }

      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: itemId, quantity: seats }],
        proration_behavior:
          process.env.IN_APP_BILLING_PRORATION === "true"
            ? "create_prorations"
            : "none",
      })

      await prisma.orgSubscription.update({
        where: { orgId: req.orgId! },
        data: { seatsPurchased: seats },
      })

      res.json(ok({ seatsPurchased: seats }))
    } catch (e) {
      next(e)
    }
  },
)

/**
 * Change plan for existing subscription
 * Requires billing admin permission
 */
inAppBillingRouter.post(
  "/plan/change",
  requireAuth,
  requireOrgMembership,
  requireBillingAdmin,
  async (req, res, next) => {
    try {
      if (process.env.IN_APP_BILLING_ENABLED !== "true") {
        throw new AppError("DISABLED", "In-app billing disabled", 400)
      }

      const plan = String(req.body?.plan ?? "").toUpperCase()
      if (!["PRO", "BUSINESS"].includes(plan)) {
        throw new AppError("VALIDATION_ERROR", "Invalid plan", 400)
      }

      const sub = await prisma.orgSubscription.findUnique({
        where: { orgId: req.orgId! },
      })

      if (!sub?.stripeSubscriptionId) {
        throw new AppError("NOT_READY", "No Stripe subscription", 400)
      }

      // Map plan to Stripe price ID
      const priceId =
        plan === "PRO"
          ? env.STRIPE_PRICE_STARTER_MONTHLY
          : env.STRIPE_PRICE_GROWTH_MONTHLY

      if (!priceId || priceId === "price_xxx") {
        throw new AppError("CONFIG_ERROR", "Missing price mapping", 500)
      }

      const stripeSub = await stripe.subscriptions.retrieve(
        sub.stripeSubscriptionId,
      )
      const itemId = stripeSub.items.data[0]?.id

      if (!itemId) {
        throw new AppError("NOT_READY", "Stripe subscription item missing", 400)
      }

      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [
          {
            id: itemId,
            price: priceId,
            quantity: Math.max(1, sub.seatsPurchased ?? 1),
          },
        ],
        proration_behavior:
          process.env.IN_APP_BILLING_PRORATION === "true"
            ? "create_prorations"
            : "none",
      })

      await prisma.orgSubscription.update({
        where: { orgId: req.orgId! },
        data: {
          plan: (plan === "BUSINESS" ? "ENTERPRISE" : "PRO") as any,
          status: "ACTIVE",
        },
      })

      res.json(ok({ plan }))
    } catch (e) {
      next(e)
    }
  },
)
