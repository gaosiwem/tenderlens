import cron from "node-cron"
import { env } from "../config/env"
import { reconcilePayFastSubscriptions } from "../billing/payfastReconciliation.service"
import { logger } from "../utils/logger"

export function schedulePayFastReconciliationJob() {
  if (!env.PAYFAST_RECONCILIATION_ENABLED) return

  cron.schedule(env.PAYFAST_RECONCILIATION_CRON, async () => {
    try {
      const result = await reconcilePayFastSubscriptions()
      if (
        result.markedPastDue > 0 ||
        result.expired > 0 ||
        result.staleCheckouts > 0
      ) {
        logger.info(result, "PayFast reconciliation complete")
      }
    } catch (err) {
      logger.error({ err }, "PayFast reconciliation failed")
    }
  })

  logger.info(
    { cron: env.PAYFAST_RECONCILIATION_CRON },
    "PayFast reconciliation scheduled",
  )
}
