import cron from "node-cron"
import { prisma } from "../db/prisma"
import { env } from "../config/env"
import { logger } from "../utils/logger"
import { applySupportTicketSlaEscalation } from "../modules/business/business.service"
import { emitSupportSlaEscalationEvents } from "../modules/business/support-escalation.service"

export function scheduleBusinessSupportJobs() {
  if (!env.BUSINESS_SUPPORT_SLA_ENABLED) return

  const cronExpr = env.BUSINESS_SUPPORT_SLA_CRON
  cron.schedule(cronExpr, async () => {
    try {
      const profiles = await prisma.orgBusinessProfile.findMany({
        where: {
          org: {
            subscription: {
              plan: "ENTERPRISE",
            },
          },
        },
        select: { orgId: true, supportSlaHours: true },
        take: 5000,
      })
      let escalated = 0

      for (const profile of profiles) {
        const result = await applySupportTicketSlaEscalation(
          profile.orgId,
          profile.supportSlaHours,
        )
        if (result.ticketIds.length > 0) {
          await emitSupportSlaEscalationEvents({
            orgId: profile.orgId,
            ticketIds: result.ticketIds,
            supportSlaHours: result.supportSlaHours,
          })
          escalated += result.ticketIds.length
        }
      }

      if (escalated > 0) {
        logger.info({ escalated }, "Business support SLA escalations processed")
      }
    } catch (e) {
      logger.error({ err: e }, "Business support SLA job failed")
    }
  })

  logger.info({ cron: cronExpr }, "Business support SLA job scheduled")
}
