import { Router } from "express"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireSystemAdmin } from "../middleware/admin.middleware"
import { ok } from "../utils/responses"
import { PLAN_CONFIG } from "../billing/plan"

export const revenueReportingRouter = Router()

function getEstimatedPlanMrrCents(plan: "PRO" | "ENTERPRISE") {
  return PLAN_CONFIG[plan].monthlyPriceCents
}

/**
 * High-level revenue dashboard for system admins
 */
revenueReportingRouter.get(
  "/stats",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const totalRevenue = await prisma.orgInvoice.aggregate({
        where: { status: "paid" },
        _sum: { amountPaid: true },
      })

      const activeSubs = await prisma.orgSubscription.count({
        where: { status: "ACTIVE" },
      })

      const growthSubs = await prisma.orgSubscription.count({
        where: { status: "ACTIVE", plan: "PRO" },
      })

      const businessSubs = await prisma.orgSubscription.count({
        where: { status: "ACTIVE", plan: "ENTERPRISE" },
      })

      const estimatedMRR =
        growthSubs * getEstimatedPlanMrrCents("PRO") +
        businessSubs * getEstimatedPlanMrrCents("ENTERPRISE")

      res.json(
        ok({
          totalRevenueCents: totalRevenue._sum.amountPaid || 0,
          activeSubscriptions: activeSubs,
          estimatedMRRCents: estimatedMRR,
          breakdown: {
            growth: growthSubs,
            business: businessSubs,
          },
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

/**
 * Detailed revenue summary for the Command Center dashboard
 */
revenueReportingRouter.get(
  "/summary",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const windowDays = 30
      // Calculate active subscriptions and breakdown by plan
      const subscriptions = await prisma.orgSubscription.findMany({
        where: { status: "ACTIVE" },
      })

      const byPlan: Record<string, number> = {}
      subscriptions.forEach((s) => {
        const rawPlan = (s.plan || "UNKNOWN").toString()
        const plan = rawPlan === "ENTERPRISE" ? "BUSINESS" : rawPlan
        byPlan[plan] = (byPlan[plan] || 0) + 1
      })

      // Revenue in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const revenue = await prisma.orgInvoice.aggregate({
        where: {
          status: "paid",
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amountPaid: true },
      })

      const growthCount = byPlan["PRO"] || 0
      const businessCount = byPlan["BUSINESS"] || 0
      const mrrEstimate =
        growthCount * getEstimatedPlanMrrCents("PRO") +
        businessCount * getEstimatedPlanMrrCents("ENTERPRISE")

      // Churned (cancelled in last 30 days)
      const churned = await prisma.orgSubscription.count({
        where: {
          status: "CANCELED",
          updatedAt: { gte: thirtyDaysAgo },
        },
      })

      res.json(
        ok({
          windowDays,
          activeSubscriptions: subscriptions.length,
          byPlan,
          churned,
          revenueCents: revenue._sum.amountPaid || 0,
          mrrEstimateCents: mrrEstimate,
          partnerAttributedUpgrades: 0, // Placeholder
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)
