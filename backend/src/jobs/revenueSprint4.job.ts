import cron from "node-cron"
import { logger } from "../utils/logger"
import { computeReferralEarnings } from "../billing/referralEarnings.service"
import { generateSegmentSnapshots } from "../billing/segments.service"
import { runRetentionCampaigns } from "../billing/retentionCampaigns.service"
import { seedOnboardingChecklist } from "../billing/onboarding.seed"

/**
 * Schedule RevenueSprint4 background jobs
 * - Referral earnings calculation (daily at 02:00)
 * - Segment snapshots (every 6 hours)
 * - Retention campaigns (daily at 09:00)
 * - Onboarding checklist seed (at startup)
 */
export function scheduleRevenueSprint4Jobs() {
  // Seed onboarding checklist at startup (idempotent)
  if (process.env.ONBOARDING_CHECKLIST_ENABLED === "true") {
    seedOnboardingChecklist()
      .then(() => logger.info("Onboarding checklist seeded"))
      .catch((e) => logger.error({ err: e }, "Onboarding seed failed"))
  }

  // Referral earnings calculation - daily at 02:00
  if (process.env.REFERRAL_PAYOUTS_ENABLED === "true") {
    const cronExpr = process.env.REFERRAL_EARNINGS_CRON || "0 2 * * *"
    cron.schedule(cronExpr, async () => {
      try {
        const result = await computeReferralEarnings()
        logger.info({ created: result.created }, "Referral earnings computed")
      } catch (e) {
        logger.error({ err: e }, "Referral earnings job failed")
      }
    })
    logger.info({ cron: cronExpr }, "Referral earnings job scheduled")
  }

  // Segment snapshots - every 6 hours
  if (process.env.SEGMENTATION_ENABLED === "true") {
    const cronExpr = process.env.SEGMENT_SNAPSHOT_CRON || "0 */6 * * *"
    cron.schedule(cronExpr, async () => {
      try {
        const result = await generateSegmentSnapshots()
        logger.info({ created: result.created }, "Segment snapshots generated")
      } catch (e) {
        logger.error({ err: e }, "Segment snapshot job failed")
      }
    })
    logger.info({ cron: cronExpr }, "Segment snapshot job scheduled")
  }

  // Retention campaigns - daily at 09:00
  if (process.env.RETENTION_CAMPAIGNS_ENABLED === "true") {
    const cronExpr = process.env.RETENTION_CAMPAIGNS_CRON || "0 9 * * *"
    cron.schedule(cronExpr, async () => {
      try {
        const result = await runRetentionCampaigns()
        logger.info({ sent: result.sent }, "Retention campaigns sent")
      } catch (e) {
        logger.error({ err: e }, "Retention campaigns job failed")
      }
    })
    logger.info({ cron: cronExpr }, "Retention campaigns job scheduled")
  }
}
