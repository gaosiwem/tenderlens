import { Queue } from "bullmq"
import { redis } from "../redis/client"

export const bidReviewQueue = new Queue("bidReview", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
  },
})
