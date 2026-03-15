import { Router } from "express"
import { ok, AppError } from "../utils/responses"

export const payoutsWebhookRouter = Router()

payoutsWebhookRouter.post("/webhook", async (req, res, next) => {
  try {
    if (process.env.PAYOUT_AUTOMATION_ENABLED !== "true")
      throw new AppError("DISABLED", "Payout automation disabled", 400)
    // provider verification would go here. for mock accept
    res.json(ok({ received: true }))
  } catch (e) {
    next(e)
  }
})
