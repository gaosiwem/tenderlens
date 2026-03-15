import { Queue } from "bullmq"
import { env } from "../../config/env"

export const extractionQueue = new Queue("tender-extract", {
  connection: { url: env.REDIS_URL },
})
