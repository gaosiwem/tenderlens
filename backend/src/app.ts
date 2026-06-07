import express from "express"
import cors from "cors"
import helmet from "helmet"
import pinoHttp from "pino-http"
import { env } from "./config/env"
import { logger } from "./utils/logger"
import { requestIdMiddleware } from "./middleware/requestId.middleware"
import { generalLimiter } from "./middleware/rateLimit.middleware"
import { errorMiddleware } from "./middleware/error.middleware"
import { prisma } from "./db/prisma"
import { requestLogMiddleware } from "./middleware/requestLog.middleware"
import { authRouter } from "./modules/auth/auth.routes"
import { orgRouter } from "./modules/orgs/org.routes"
import { meRouter } from "./modules/me/me.routes"
import { billingRouter } from "./modules/billing/billing.routes"
import { tenderRouter } from "./modules/tenders/tender.routes"
import { jobsRouter } from "./modules/jobs/jobs.routes"
import { searchRouter } from "./modules/search/search.routes"
import { tenderExtraRouter } from "./modules/tenders/tender.extra.routes"
import { chatRouter } from "./modules/chat/chat.routes"
import { policyRouter } from "./modules/billing/policy.routes"
import { summariesRouter } from "./modules/summaries/summaries.routes"
import { notificationsRouter } from "./modules/notifications/notifications.routes"
import { exportRouter } from "./modules/export/export.routes"
import { watchlistRouter } from "./modules/watchlist/watchlist.routes"
import { preferencesRouter } from "./modules/preferences/preferences.routes"
import { deadlinesRouter } from "./modules/deadlines/deadlines.routes"
import { timelineRouter } from "./modules/tenders/timeline.routes"
import { alertsRouter } from "./modules/alerts/alerts.routes"
import { deliveriesRouter } from "./modules/notifications/deliveries.routes"
import { smsVerificationRouter } from "./modules/whatsapp/verification.routes"
import { templatesRouter } from "./modules/watchlist/templates.routes"
import { aiRouter } from "./modules/tenders/ai.routes"
import { workspaceRouter } from "./modules/workspace/workspace.routes"
import { orgDocsRouter } from "./modules/orgDocs/orgDocs.routes"
import { attachmentsRouter } from "./modules/attachments/attachments.routes"
import { riskRouter } from "./modules/risk/risk.routes"
import { complianceRouter } from "./modules/compliance/compliance.routes"
import { bidReviewRouter } from "./modules/bidReview/bidReview.routes"
import { invitesRouter } from "./modules/org/invites.routes"
import { inviteAcceptRouter } from "./modules/org/invites.accept"
import { experimentsRouter } from "./billing/experiments.routes"
import { referralsRouter } from "./billing/referrals.routes"
import { referralPayoutRouter } from "./billing/referralPayout.routes"
import { onboardingRouter } from "./billing/onboarding.routes"
import { experimentsV2Router } from "./billing/experimentsV2.routes"
import { partnersRouter } from "./partners/partners.routes"
import { payoutsWebhookRouter } from "./payouts/payouts.webhook"
import { offersRouter } from "./billing/offers.routes"
import { revenueReportingRouter } from "./admin/revenueReporting.routes"
import { billingAnalyticsRouter } from "./admin/billing-analytics.routes"
import { businessAdminRouter } from "./admin/business-admin.routes"
import { settingsRouter } from "./modules/settings/settings.routes"
import { businessRouter } from "./modules/business/business.routes"
import { ok, fail, AppError } from "./utils/responses"

export function createApp() {
  const app = express()
  const allowedOrigins = env.CORS_ORIGINS
  const allowNoOriginPaths = new Set(env.CORS_ALLOW_NO_ORIGIN_PATHS)
  const corsOptions = {
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-org-id",
      "x-request-id",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }

  app.use(requestIdMiddleware)
  app.use(
    cors((req, cb) => {
      const origin = req.header("origin") ?? ""
      const path = req.path || req.originalUrl || ""

      if (!origin) {
        if (allowNoOriginPaths.has(path)) {
          return cb(null, corsOptions)
        }

        logger.warn({ path }, "CORS blocked: missing origin")
        return cb(new AppError("FORBIDDEN", "CORS blocked", 403))
      }

      if (allowedOrigins.includes(origin)) {
        return cb(null, {
          ...corsOptions,
          origin,
        })
      }

      logger.warn({ origin, allowedOrigins, path }, "CORS blocked")
      return cb(new AppError("FORBIDDEN", "CORS blocked", 403))
    }),
  )
  app.use(pinoHttp({ logger }))
  app.use(helmet())
  app.use(generalLimiter)

  app.use(express.json({ limit: "1mb" }))
  app.use(requestLogMiddleware)

  app.get("/health", (_req, res) => res.json(ok({ status: "ok" })))

  app.get("/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json(ok({ status: "ready" }))
    } catch {
      res.status(503).json(fail("NOT_READY", "Database unavailable"))
    }
  })

  app.use("/api/v1/auth", authRouter)
  app.use("/api/v1/me", meRouter)
  app.use("/api/v1/orgs", orgRouter)
  app.use("/api/v1/tenders", tenderRouter)
  app.use("/api/v1/jobs", jobsRouter)
  app.use("/api/v1/search", searchRouter)
  app.use("/api/v1/tenders", tenderExtraRouter)
  app.use("/api/v1/chat", chatRouter)
  app.use("/api/v1/billing/policy", policyRouter)
  app.use("/api/v1/billing", billingRouter)
  app.use("/api/v1/summaries", summariesRouter)
  app.use("/api/v1/notifications", notificationsRouter)
  app.use("/api/v1/notifications/history", deliveriesRouter)
  app.use("/api/v1/export", exportRouter)
  app.use("/api/v1/alerts", alertsRouter)
  app.use("/api/v1/watchlist", watchlistRouter)
  app.use("/api/v1/preferences", preferencesRouter)
  app.use("/api/v1/deadlines", deadlinesRouter)
  app.use("/api/v1", timelineRouter)
  app.use("/api/v1/sms", smsVerificationRouter)
  app.use("/api/v1/templates", templatesRouter)
  app.use("/api/v1/ai", aiRouter)
  app.use("/api/v1/org-docs", orgDocsRouter)
  app.use("/api/v1/tenders", workspaceRouter)
  app.use("/api/v1/workspace", workspaceRouter)
  app.use("/api/v1/attachments", attachmentsRouter)
  app.use("/api/v1/risk", riskRouter)
  app.use("/api/v1", complianceRouter)
  app.use("/api/v1", bidReviewRouter)
  app.use("/api/v1/exports", exportRouter)
  app.use("/api/v1/business", businessRouter)

  // Sprint 3 - Revenue
  app.use("/api/v1/orgs", invitesRouter)
  app.use("/api/v1/orgs", inviteAcceptRouter)
  app.use("/api/v1/billing/experiments", experimentsRouter)
  app.use("/api/v1/referrals", referralsRouter)

  // Sprint 4 - Revenue: Referral Payouts, Segmentation, Onboarding
  app.use("/api/v1/referrals", referralPayoutRouter)
  app.use("/api/v1/onboarding", onboardingRouter)
  app.use("/api/v1/billing", experimentsV2Router)

  // Sprint 5 - Revenue: Partners, Payouts, Offers, Reporting
  app.use("/api/v1/partners", partnersRouter)
  app.use("/api/v1/payouts", payoutsWebhookRouter)
  app.use("/api/v1/billing/offers", offersRouter)
  app.use("/api/v1/admin/revenue", revenueReportingRouter)
  app.use("/api/v1/admin/business", businessAdminRouter)
  app.use("/api/v1/billing/events", billingAnalyticsRouter)
  app.use("/api/v1/admin/settings", settingsRouter)

  app.use(errorMiddleware)

  return app
}
