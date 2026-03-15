import { Queue } from "bullmq"
import { redis } from "../redis/client"

import { env } from "../config/env"

export const deliveryQueue = new Queue("notificationDelivery", {
  connection: redis,
  defaultJobOptions: {
    attempts: env.DELIVERY_MAX_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: env.DELIVERY_BACKOFF_BASE_SECONDS * 1000,
    },
  },
})
