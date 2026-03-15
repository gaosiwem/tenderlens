import { Twilio } from "twilio"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"

export async function sendWhatsApp(to: string, text: string) {
  if (!env.WHATSAPP_ENABLED)
    throw new AppError("WHATSAPP_DISABLED", "WhatsApp disabled", 400)
  if (env.WHATSAPP_PROVIDER !== "twilio")
    throw new AppError("CONFIG_ERROR", "Unsupported provider", 500)
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN)
    throw new AppError("CONFIG_ERROR", "Twilio credentials missing", 500)
  if (!env.WHATSAPP_FROM_NUMBER)
    throw new AppError("CONFIG_ERROR", "WHATSAPP_FROM_NUMBER missing", 500)

  const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

  await client.messages.create({
    from: env.WHATSAPP_FROM_NUMBER,
    to,
    body: text,
  })
}
