import http from "http"
import { env } from "./config/env"
import { createApp } from "./app"
import { logger } from "./utils/logger"
import { initSocket } from "./realtime/socket"
import { setIO } from "./realtime/broadcast"

import { scheduleReminderJobs } from "./jobs/reminders.job"
import { scheduleRevenueSprint3Jobs } from "./jobs/revenueSprint3.job"
import { scheduleRevenueSprint4Jobs } from "./jobs/revenueSprint4.job"
import { scheduleRevenueSprint5Jobs } from "./jobs/revenueSprint5.job"
import { scheduleBusinessSupportJobs } from "./jobs/businessSupport.job"

const app = createApp()
const server = http.createServer(app)
const io = initSocket(server)
setIO(io)

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API server listening")

  scheduleReminderJobs()
  scheduleRevenueSprint3Jobs()
  scheduleRevenueSprint4Jobs()
  scheduleRevenueSprint5Jobs()
  scheduleBusinessSupportJobs()
})
