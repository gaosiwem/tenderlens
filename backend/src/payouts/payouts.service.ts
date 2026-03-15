import { prisma } from "../db/prisma"
import { mockProvider } from "./providers/mock"
import {
  PayoutAttemptStatus,
  PayoutBatchStatus,
  PayoutStatus,
} from "@prisma/client"

function provider() {
  return mockProvider
}

export async function createAndProcessPayoutBatch() {
  if (process.env.PAYOUT_AUTOMATION_ENABLED !== "true") return { skipped: true }

  const currency = "ZAR"
  const pending = await prisma.referralEarning.findMany({
    where: { status: "APPROVED" },
    take: 200,
  })

  if (pending.length === 0) return { created: 0, processed: 0 }

  const batch = await prisma.payoutBatch.create({
    data: {
      provider: provider().name,
      status: PayoutBatchStatus.PROCESSING,
      totalCents: pending.reduce((a, b) => a + b.amountCents, 0),
      currency,
    },
  })

  const recipients = pending.map((e) => ({
    id: e.id,
    amountCents: e.amountCents,
    currency,
  }))
  const results = await provider().sendBatch(batch.id, recipients)

  for (const r of results) {
    await prisma.payoutAttempt.create({
      data: {
        batchId: batch.id,
        earningId: r.earningId,
        providerRef: r.providerRef,
        status: r.ok ? PayoutAttemptStatus.SENT : PayoutAttemptStatus.FAILED,
        error: r.error,
      },
    })

    if (r.ok) {
      await prisma.referralEarning.update({
        where: { id: r.earningId },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      })
    }
  }

  await prisma.payoutBatch.update({
    where: { id: batch.id },
    data: {
      status: results.every((r) => r.ok)
        ? PayoutBatchStatus.COMPLETED
        : PayoutBatchStatus.FAILED,
      processedAt: new Date(),
    },
  })

  return { created: 1, processed: results.length }
}
