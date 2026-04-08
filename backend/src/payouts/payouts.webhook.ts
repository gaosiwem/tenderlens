import { Router } from "express"
import crypto from "crypto"
import { env } from "../config/env"
import { ok, AppError } from "../utils/responses"

export const payoutsWebhookRouter = Router()

function hasValidWebhookSecret(candidate: string) {
  const expected = env.PAYOUT_WEBHOOK_SECRET.trim()
  if (!expected) return false
  const actual = candidate.trim()
  if (!actual) return false

  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  if (expectedBuffer.length !== actualBuffer.length) return false

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

payoutsWebhookRouter.post("/webhook", async (req, res, next) => {
  try {
    if (process.env.PAYOUT_AUTOMATION_ENABLED !== "true")
      throw new AppError("DISABLED", "Payout automation disabled", 400)
    if (env.NODE_ENV !== "development") {
      throw new AppError(
        "FORBIDDEN",
        "Mock payout webhook is disabled outside development",
        403,
      )
    }
    if (!env.PAYOUT_WEBHOOK_SECRET.trim()) {
      throw new AppError(
        "CONFIG_ERROR",
        "PAYOUT_WEBHOOK_SECRET must be configured for development webhook tests",
        500,
      )
    }
    if (
      !hasValidWebhookSecret(String(req.header("x-payout-webhook-secret") ?? ""))
    ) {
      throw new AppError("FORBIDDEN", "Invalid payout webhook secret", 403)
    }

    const eventId = String(req.body?.eventId ?? "").trim()
    if (!eventId) {
      throw new AppError("VALIDATION_ERROR", "eventId is required", 400)
    }

    res.json(ok({ received: true, eventId }))
  } catch (e) {
    next(e)
  }
})
