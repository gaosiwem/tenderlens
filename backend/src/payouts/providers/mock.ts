import { PayoutProvider } from "./provider"

export const mockProvider: PayoutProvider = {
  name: "mock",
  async sendBatch(batchId, recipients) {
    return recipients.map((r) => ({
      earningId: r.id,
      providerRef: `mock_${batchId}_${r.id}`,
      ok: true,
    }))
  },
  verifyWebhook() {
    return true
  },
}
