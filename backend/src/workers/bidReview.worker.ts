import { Worker } from "bullmq"
import { redis } from "../redis/client"
import { env } from "../config/env"
import { runBidReview } from "../modules/bidReview/bidReview.service"
import { captureBackgroundException } from "../monitoring/sentry"

export function startBidReviewWorker() {
  if (!env.BID_REVIEWER_QUEUE_ENABLED) return null

  const worker = new Worker(
    "bidReview",
    async (job) => {
      await runBidReview(String(job.data.reviewId))
    },
    { connection: redis },
  )

  worker.on("failed", (job, err) => {
    captureBackgroundException(err, {
      service: "worker",
      area: "queue",
      mechanism: "bidReview.failed",
      queue: "bidReview",
      jobId: job?.id ? String(job.id) : null,
    })
    console.error(`Bid review job ${job?.id} failed: ${err.message}`)
  })

  return worker
}
