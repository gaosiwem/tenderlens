import { NotificationType } from "@prisma/client"
import { emitEvent } from "../notifications/notifications.service"
import { getAlertAutomationForOrg } from "./business.service"

export async function emitSupportSlaEscalationEvents(args: {
  orgId: string
  ticketIds: string[]
  supportSlaHours: number
}) {
  if (!args.ticketIds.length) return { sent: 0 }

  const automation = await getAlertAutomationForOrg(args.orgId)
  const channels = automation?.alertEscalationEnabled
    ? automation.escalationChannels
    : automation?.defaultChannels
  const targetChannels =
    channels && channels.length > 0 ? channels : (["email"] as Array<"email" | "whatsapp">)

  let sent = 0
  for (const ticketId of args.ticketIds) {
    await emitEvent({
      orgId: args.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "OrgSupportTicket",
      entityId: ticketId,
      targetChannels,
      ignoreEventTypePrefs: true,
      ignoreChannelPrefs: false,
      meta: {
        reason: "SLA_BREACHED",
        supportSlaHours: args.supportSlaHours,
        escalation: "priority_urgent",
      },
    })
    sent += 1
  }

  return { sent }
}
