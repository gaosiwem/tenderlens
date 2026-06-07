import crypto from "crypto"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"

function normalizeMyMobileApiDestination(value: string) {
  return value.trim().replace(/^\+/, "")
}

async function sendSmsSouthAfrica(to: string, text: string) {
  if (!env.SMSSOUTHAFRICA_CLIENT_ID || !env.SMSSOUTHAFRICA_CLIENT_SECRET) {
    throw new AppError(
      "CONFIG_ERROR",
      "SMS South Africa credentials missing",
      500,
    )
  }

  const auth = Buffer.from(
    `${env.SMSSOUTHAFRICA_CLIENT_ID}:${env.SMSSOUTHAFRICA_CLIENT_SECRET}`,
  ).toString("base64")

  const body = {
    sendOptions: {
      ...(env.SMSSOUTHAFRICA_SENDER_ID
        ? { senderId: env.SMSSOUTHAFRICA_SENDER_ID }
        : {}),
      testMode: env.SMSSOUTHAFRICA_TEST_MODE,
      campaignName: "TenderLens",
      costCentre: "notifications",
    },
    messages: [
      {
        content: text,
        destination: normalizeMyMobileApiDestination(to),
        customerId: crypto.randomUUID(),
      },
    ],
  }

  const response = await fetch(env.SMSSOUTHAFRICA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  let responseBody: unknown = responseText
  try {
    responseBody = responseText ? JSON.parse(responseText) : null
  } catch {
    responseBody = responseText
  }

  if (!response.ok) {
    throw new AppError(
      "SMS_DELIVERY_FAILED",
      "SMS South Africa delivery failed",
      502,
      {
        provider: "smssouthafrica",
        status: response.status,
        response: responseBody,
      },
    )
  }
}

async function sendSmtp2goSms(to: string, text: string) {
  if (!env.SMTP2GO_API_KEY) {
    throw new AppError("CONFIG_ERROR", "SMTP2GO_API_KEY missing", 500)
  }

  const body = {
    api_key: env.SMTP2GO_API_KEY,
    destination: [to],
    content: text,
    ...(env.SMTP2GO_SMS_SENDER ? { sender: env.SMTP2GO_SMS_SENDER } : {}),
  }

  const response = await fetch(env.SMTP2GO_SMS_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Smtp2go-Api-Key": env.SMTP2GO_API_KEY,
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  let responseBody: any = responseText
  try {
    responseBody = responseText ? JSON.parse(responseText) : null
  } catch {
    responseBody = responseText
  }

  if (!response.ok || responseBody?.result === "error") {
    throw new AppError(
      "SMS_DELIVERY_FAILED",
      responseBody?.data?.error ?? responseBody?.error ?? "SMTP2GO delivery failed",
      502,
      {
        provider: "smtp2go",
        status: response.status,
        response: responseBody,
      },
    )
  }
}

export async function sendSms(to: string, text: string) {
  if (!env.SMS_ENABLED) {
    throw new AppError("SMS_DISABLED", "SMS disabled", 400)
  }

  if (env.SMS_PROVIDER === "log") {
    console.info(`[sms:log] to=${to} text=${text}`)
    return
  }

  if (env.SMS_PROVIDER === "smtp2go") {
    await sendSmtp2goSms(to, text)
    return
  }

  if (env.SMS_PROVIDER === "smssouthafrica") {
    await sendSmsSouthAfrica(to, text)
    return
  }

  throw new AppError("CONFIG_ERROR", "Unsupported SMS provider", 500, {
    provider: env.SMS_PROVIDER,
  })
}
