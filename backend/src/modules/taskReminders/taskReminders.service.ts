import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { emitEvent } from "../notifications/notifications.service"
import { NotificationType } from "@prisma/client"

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 60 * 60_000)
}

export async function planDueSoonReminders() {
  if (!env.TASK_REMINDERS_ENABLED) return { planned: 0 }

  const dueBy = hoursFromNow(env.TASK_REMINDER_DUE_HOURS || 24)
  const now = new Date()

  const tasks = await prisma.bidTask.findMany({
    where: {
      status: { not: "DONE" },
      dueAt: { gte: now, lte: dueBy },
      ownerId: { not: null },
    },
    take: 200,
    include: { workspace: true },
  })

  let planned = 0
  for (const t of tasks) {
    const fireAt = new Date(t.dueAt!.getTime() - 60 * 60_000) // 1 hour before due
    if (fireAt < now) continue

    try {
      await prisma.taskReminderLog.create({
        data: {
          orgId: t.workspace.orgId,
          taskId: t.id,
          userId: t.ownerId!,
          type: "DUE_SOON",
          fireAt,
        },
      })
      planned++
    } catch {
      // ignore dupes
    }
  }

  return { planned }
}

export async function planRemindersForWatchlist(args: {
  orgId: string
  tenderId: string
  userId: string
}) {
  const tender = await prisma.tender.findUnique({
    where: { id: args.tenderId },
    include: { deadlines: true },
  })

  if (!tender || !tender.deadlines) return

  const d = tender.deadlines
  const types: { type: any; date: Date | null }[] = [
    { type: "SITE_VISIT", date: d.siteVisitAt },
  ]

  for (const t of types) {
    if (!t.date) continue
    const fireAt = new Date(t.date.getTime() - 24 * 60 * 60_000) // 24h before
    if (fireAt < new Date()) continue

    try {
      await prisma.tenderReminder.create({
        data: {
          orgId: args.orgId,
          tenderId: args.tenderId,
          userId: args.userId,
          type: t.type,
          fireAt,
        },
      })
    } catch {}
  }
}

export async function fireDueTaskReminders(now = new Date()) {
  const due = await prisma.taskReminderLog.findMany({
    where: { firedAt: null, fireAt: { lte: now }, type: "DUE_SOON" },
    orderBy: { fireAt: "asc" },
    take: 100,
  })

  let fired = 0
  for (const r of due) {
    await emitEvent({
      orgId: r.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "BidTask",
      entityId: r.taskId,
      meta: { kind: "TASK_DUE_SOON", toUserId: r.userId, fireAt: r.fireAt },
    })
    await prisma.taskReminderLog.update({
      where: { id: r.id },
      data: { firedAt: new Date() },
    })
    fired++
  }

  return { fired }
}
