import { Queue } from "bullmq"
import { env } from "../../config/env"
import type { ExtractJobPayload } from "./jobs"

export const extractionQueue = new Queue("tender-extract", {
  connection: { url: env.REDIS_URL },
})

const EXTRACTION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 1500 },
  removeOnComplete: 1000,
  removeOnFail: 2000,
}

export function enqueueExtractionJob(payload: ExtractJobPayload) {
  return extractionQueue.add("extract-text", payload, {
    ...EXTRACTION_JOB_OPTIONS,
    jobId: payload.processingJobId,
  })
}
