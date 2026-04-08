import { Twilio } from "twilio"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"

export async function sendSms(to: string, text: string) {
  if (!env.SMS_ENABLED) {
    throw new AppError("SMS_DISABLED", "SMS disabled", 400)
  }
  if (env.SMS_PROVIDER !== "twilio") {
    throw new AppError("CONFIG_ERROR", "Unsupported SMS provider", 500)
  }
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new AppError("CONFIG_ERROR", "Twilio credentials missing", 500)
  }
  if (!env.SMS_FROM_NUMBER) {
    throw new AppError("CONFIG_ERROR", "SMS_FROM_NUMBER missing", 500)
  }

  const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

  try {
    await client.messages.create({
      from: env.SMS_FROM_NUMBER,
      to,
      body: text,
    })
  } catch (error: any) {
    throw new AppError(
      "SMS_DELIVERY_FAILED",
      error?.message ?? "SMS delivery failed",
      502,
      {
        provider: "twilio",
        twilioCode: error?.code ?? null,
        status: error?.status ?? null,
        moreInfo: error?.moreInfo ?? null,
      },
    )
  }
}
