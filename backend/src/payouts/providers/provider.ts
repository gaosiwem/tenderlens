export type PayoutRecipient = {
  id: string
  amountCents: number
  currency: string
  meta?: any
}

export interface PayoutProvider {
  name: string
  sendBatch(
    batchId: string,
    recipients: PayoutRecipient[],
  ): Promise<
    Array<{
      earningId: string
      providerRef?: string
      ok: boolean
      error?: string
    }>
  >
  verifyWebhook(req: any): boolean
}
