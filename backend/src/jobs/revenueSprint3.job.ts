import cron from "node-cron"
import { env } from "../config/env"
import { runTrialCampaigns } from "../billing/trialCampaigns.service"
import { runEntitlementWarnings } from "../billing/entitlements.service"
import { sendWeeklyValueSummaries } from "../billing/valueSummary.service"
import { logger } from "../utils/logger"

export function scheduleRevenueSprint3Jobs() {
  if (env.TRIAL_CAMPAIGNS_ENABLED) {
    // Run every hour
    cron.schedule("0 * * * *", async () => {
      logger.info("Running trial campaigns...")
      try {
        const res = await runTrialCampaigns()
        logger.info({ queued: res.queued }, "Trial campaigns run complete")
      } catch (e) {
        logger.error(e, "Trial campaigns failed")
      }
    })
  }

  if (env.ENTITLEMENT_WARNINGS_ENABLED) {
    // Run every 30 mins
    cron.schedule("*/30 * * * *", async () => {
      logger.info("Running entitlement warnings...")
      try {
        const res = await runEntitlementWarnings()
        logger.info({ sent: res.sent }, "Entitlement warnings run complete")
      } catch (e) {
        logger.error(e, "Entitlement warnings failed")
      }
    })
  }

  if (env.VALUE_SUMMARY_ENABLED) {
    // Run every Monday at 9am
    cron.schedule("0 9 * * 1", async () => {
      logger.info("Running weekly value summary...")
      try {
        const res = await sendWeeklyValueSummaries()
        logger.info({ sent: res.sent }, "Weekly value summary run complete")
      } catch (e) {
        logger.error(e, "Weekly value summary failed")
      }
    })
  }
}
