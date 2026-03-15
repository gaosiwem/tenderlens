import { prisma } from "../../db/prisma"

export async function getOrgRecipientEmails(orgId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      orgId,
      role: { in: ["OWNER", "ADMIN", "MEMBER"] },
    },
    include: { user: true },
  })
  const emails = memberships.map((m) => m.user.email).filter(Boolean)
  return Array.from(new Set(emails))
}

export async function getOrgNotificationRecipients(orgId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      orgId,
      role: { in: ["OWNER", "ADMIN", "MEMBER"] },
    },
    include: { user: { select: { id: true, email: true } } },
  })

  const userIds = memberships.map((m) => m.userId)
  const prefs = await prisma.userNotificationPrefs.findMany({
    where: { orgId, userId: { in: userIds } },
  })
  const prefsByUserId = new Map(prefs.map((p) => [p.userId, p]))

  return memberships.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    prefs: prefsByUserId.get(m.userId) ?? null,
  }))
}
