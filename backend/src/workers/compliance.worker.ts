import { Worker } from "bullmq"
import { redis } from "../redis/client"
import { env } from "../config/env"
import { runComplianceAudit } from "../modules/compliance/compliance.service"
import { captureBackgroundException } from "../monitoring/sentry"

export function startComplianceWorker() {
  if (!env.COMPLIANCE_AUDITOR_QUEUE_ENABLED) return null

  const worker = new Worker(
    "complianceAudit",
    async (job) => {
      await runComplianceAudit(String(job.data.auditId))
    },
    { connection: redis },
  )

  worker.on("failed", (job, err) => {
    captureBackgroundException(err, {
      service: "worker",
      area: "queue",
      mechanism: "compliance.failed",
      queue: "complianceAudit",
      jobId: job?.id ? String(job.id) : null,
    })
    console.error(`Compliance audit job ${job?.id} failed: ${err.message}`)
  })

  return worker
}
