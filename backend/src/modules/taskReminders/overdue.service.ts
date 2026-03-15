import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { emitEvent } from "../notifications/notifications.service"
import { NotificationType } from "@prisma/client"

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function sendOverdueReminders(now = new Date()) {
  if (!env.TASK_REMINDERS_ENABLED) return { sent: 0 }
  const day = startOfDay(now)

  const tasks = await prisma.bidTask.findMany({
    where: {
      status: { not: "DONE" },
      dueAt: { lt: now },
      ownerId: { not: null },
    },
    take: 200,
    include: { workspace: true },
  })

  let sent = 0
  for (const t of tasks) {
    // once per day
    try {
      await (prisma as any).taskReminderLog.create({
        data: {
          orgId: t.workspace.orgId,
          taskId: t.id,
          userId: t.ownerId!,
          type: "OVERDUE",
          fireAt: day,
        },
      })
    } catch {
      continue
    }

    await emitEvent({
      orgId: t.workspace.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "BidTask",
      entityId: t.id,
      meta: {
        kind: "TASK_OVERDUE",
        toUserId: t.ownerId,
        dueAt: t.dueAt,
      },
    })

    sent++
  }

  return { sent }
}
