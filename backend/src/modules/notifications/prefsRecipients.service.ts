import { prisma } from "../../db/prisma"
import { getEffectivePlanConfig } from "../../billing/effective-plan.service"

export async function getRecipientsForChannel(args: {
  orgId: string
  channel: "email" | "whatsapp"
  eventType: string
}) {
  const { config: cfg } = await getEffectivePlanConfig(args.orgId)

  if (args.channel === "whatsapp" && !cfg.whatsapp) {
    return []
  }

  const memberships = await prisma.membership.findMany({
    where: { orgId: args.orgId },
    include: { user: true },
  })

  const userIds = memberships.map((m) => m.userId)
  const prefs = await prisma.userNotificationPrefs.findMany({
    where: { orgId: args.orgId, userId: { in: userIds } },
  })

  const prefsByUser = new Map(prefs.map((p) => [p.userId, p]))
  const out: Array<{ userId: string; to: string }> = []

  for (const m of memberships) {
    const p = prefsByUser.get(m.userId)
    if (!p) {
      // Default to email if no prefs yet
      if (args.channel === "email" && m.user.email) {
        out.push({ userId: m.userId, to: m.user.email })
      }
      continue
    }

    if (p.eventTypes.length > 0 && !p.eventTypes.includes(args.eventType))
      continue

    if (args.channel === "email") {
      if (!p.emailEnabled) continue
      const email = m.user.email
      if (email) out.push({ userId: m.userId, to: email })
    }

    if (args.channel === "whatsapp") {
      if (!p.whatsappEnabled) continue
      const num = p.whatsappNumber
      if (num) out.push({ userId: m.userId, to: num })
    }
  }

  return out
}
