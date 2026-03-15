import cron from "node-cron"
import { logger } from "../utils/logger"
import { generateUpgradeOffers } from "../billing/offers.service"
import { createAndProcessPayoutBatch } from "../payouts/payouts.service"

/**
 * Schedule RevenueSprint5 background jobs
 * - Offer generator (every 15 minutes)
 * - Payout processing (daily at 03:00)
 */
export function scheduleRevenueSprint5Jobs() {
  // Offer generator - every 15 minutes
  if (process.env.UPGRADE_OFFERS_ENABLED === "true") {
    const cronExpr = process.env.UPGRADE_OFFERS_CRON || "*/15 * * * *"
    cron.schedule(cronExpr, async () => {
      try {
        const result = await generateUpgradeOffers()
        if (result.created > 0) {
          logger.info({ created: result.created }, "Upgrade offers generated")
        }
      } catch (e) {
        logger.error({ err: e }, "Offer generation job failed")
      }
    })
    logger.info({ cron: cronExpr }, "Upgrade offers job scheduled")
  }

  // Payout batch processor - daily at 03:00
  if (process.env.PAYOUT_AUTOMATION_ENABLED === "true") {
    const cronExpr = process.env.PAYOUT_BATCH_CRON || "0 3 * * *"
    cron.schedule(cronExpr, async () => {
      try {
        const result = await createAndProcessPayoutBatch()
        if ("processed" in result && result.processed && result.processed > 0) {
          logger.info({ processed: result.processed }, "Payout batch processed")
        }
      } catch (e) {
        logger.error({ err: e }, "Payout processing job failed")
      }
    })
    logger.info({ cron: cronExpr }, "Payout processing job scheduled")
  }
}
