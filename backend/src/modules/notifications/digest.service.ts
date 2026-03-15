import { prisma } from "../../db/prisma"
import { sendEmail } from "./email.sender"
import { env } from "../../config/env"
import { buildDailyDigestContent } from "./message.builder"

export async function runDailyDigest(now = new Date()) {
  if (!env.DIGEST_ENABLED) return { sent: 0 }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const userPrefs = await prisma.userNotificationPrefs.findMany({
    where: { digestMode: true, emailEnabled: true },
    include: {
      user: {
        select: { email: true },
      },
    },
  })

  // Group by orgId
  const orgIds = Array.from(new Set(userPrefs.map((u) => u.orgId)))
  const allEvents = await prisma.notificationEvent.findMany({
    where: {
      orgId: { in: orgIds },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 500, // Limit total events for digest safety, though ideally we'd paginate per org if needed
  })

  const eventsByOrg = new Map<string, typeof allEvents>()
  for (const event of allEvents) {
    if (!eventsByOrg.has(event.orgId)) eventsByOrg.set(event.orgId, [])
    eventsByOrg.get(event.orgId)!.push(event)
  }

  let sent = 0
  for (const pref of userPrefs) {
    const items = eventsByOrg.get(pref.orgId)
    if (!items || !items.length) continue

    const userEmail = pref.user?.email
    if (!userEmail) continue

    const digest = buildDailyDigestContent({
      events: items.slice(0, 50),
      generatedAt: now,
    })

    await sendEmail(userEmail, digest.subject, digest.text, digest.html)
    sent++
  }

  return { sent }
}
