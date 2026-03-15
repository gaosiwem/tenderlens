import { prisma } from "../../db/prisma"
import { extractMentions } from "../../utils/mentions"
import { emitEvent } from "../notifications/notifications.service"
import { NotificationType } from "@prisma/client"

export async function handleMentions(args: {
  orgId: string
  taskId: string
  commentId: string
  fromUserId: string
  commentBody: string
}) {
  const emails = extractMentions(args.commentBody)
  if (!emails.length) return { mentioned: 0 }

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })
  if (!users.length) return { mentioned: 0 }

  // ensure they belong to org
  const members = await prisma.membership.findMany({
    where: { orgId: args.orgId, userId: { in: users.map((u) => u.id) } },
  })
  const memberSet = new Set(members.map((m) => m.userId))

  let mentioned = 0
  for (const u of users) {
    if (!memberSet.has(u.id)) continue

    await prisma.mention.create({
      data: {
        orgId: args.orgId,
        taskId: args.taskId,
        commentId: args.commentId,
        fromUserId: args.fromUserId,
        toUserId: u.id,
      },
    })

    // Create a reminder log entry to prevent repeated mention spam in same minute
    const fireAt = new Date()
    try {
      await prisma.taskReminderLog.create({
        data: {
          orgId: args.orgId,
          taskId: args.taskId,
          userId: u.id,
          type: "MENTIONED",
          fireAt,
        },
      })
    } catch {
      // ignore duplicates
    }

    await emitEvent({
      orgId: args.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "BidTask",
      entityId: args.taskId,
      meta: {
        kind: "MENTION",
        toUserId: u.id,
        fromUserId: args.fromUserId,
        commentId: args.commentId,
      },
    })

    mentioned++
  }

  return { mentioned }
}
