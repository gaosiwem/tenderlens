import cron from "node-cron"
import { env } from "../config/env"
import {
  scheduleReminders,
  fireDueReminders,
} from "../modules/deadlines/reminders.service"
import {
  planDueSoonReminders,
  fireDueTaskReminders,
} from "../modules/taskReminders/taskReminders.service"
import { sendOverdueReminders } from "../modules/taskReminders/overdue.service"

export function scheduleReminderJobs() {
  if (!env.REMINDERS_ENABLED) return

  cron.schedule(env.REMIDER_CRON, async () => {
    try {
      await scheduleReminders()
      await fireDueReminders()
    } catch (e) {
      console.error("Reminder job failed:", e)
    }
  })

  if (env.TASK_REMINDERS_ENABLED) {
    cron.schedule(env.TASK_REMINDER_DUE_CRON, async () => {
      try {
        await planDueSoonReminders()
        await fireDueTaskReminders()
      } catch (e) {
        console.error("Task due reminder job failed:", e)
      }
    })

    cron.schedule(env.TASK_REMINDER_OVERDUE_CRON, async () => {
      try {
        await sendOverdueReminders()
      } catch (e) {
        console.error("Task overdue reminder job failed:", e)
      }
    })
  }
}
