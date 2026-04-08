import crypto from "crypto"
import { env } from "../config/env"

type PayFastCheckoutArgs = {
  orgId: string
  userId: string
  plan: "PRO" | "BUSINESS"
  amountCents: number
  email: string
  firstName: string
  lastName: string
  reference: string
  orgName: string
  returnUrl?: string
  cancelUrl?: string
}

type PayFastNotifyPayload = Record<string, string>

const PAYFAST_SANDBOX_DEFAULTS = {
  recurring: {
    merchantId: "10004002",
    merchantKey: "q1cd2rdny4a53",
    passphrase: "payfast",
  },
} as const

function encodeValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+")
}

function usingSandboxDefaults() {
  return (
    env.PAYFAST_SANDBOX &&
    !env.PAYFAST_MERCHANT_ID.trim() &&
    !env.PAYFAST_MERCHANT_KEY.trim()
  )
}

function getPayFastMerchantId() {
  if (env.PAYFAST_MERCHANT_ID.trim()) return env.PAYFAST_MERCHANT_ID.trim()
  if (usingSandboxDefaults()) return PAYFAST_SANDBOX_DEFAULTS.recurring.merchantId
  return ""
}

function getPayFastMerchantKey() {
  if (env.PAYFAST_MERCHANT_KEY.trim()) return env.PAYFAST_MERCHANT_KEY.trim()
  if (usingSandboxDefaults()) return PAYFAST_SANDBOX_DEFAULTS.recurring.merchantKey
  return ""
}

function getPayFastPassphrase() {
  if (env.PAYFAST_PASSPHRASE.trim()) return env.PAYFAST_PASSPHRASE.trim()
  if (usingSandboxDefaults()) return PAYFAST_SANDBOX_DEFAULTS.recurring.passphrase
  return ""
}

function buildSignatureString(entries: Array<[string, string]>) {
  const filtered = entries.filter(
    ([key, value]) =>
      key !== "signature" &&
      value != null &&
      String(value).trim().length > 0,
  )

  const pairs = filtered.map(([key, value]) => `${key}=${encodeValue(value)}`)
  const passphrase = getPayFastPassphrase()
  if (passphrase) {
    pairs.push(`passphrase=${encodeValue(passphrase)}`)
  }

  return pairs.join("&")
}

function createSignatureFromEntries(entries: Array<[string, string]>) {
  const signatureString = buildSignatureString(entries)
  return crypto.createHash("md5").update(signatureString).digest("hex")
}

function amountToString(amountCents: number) {
  return (amountCents / 100).toFixed(2)
}

function getProcessUrl() {
  return env.PAYFAST_SANDBOX
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process"
}

function getValidateUrl() {
  return env.PAYFAST_SANDBOX
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate"
}

function getBillingDate() {
  const d = new Date()
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function ensurePayFastConfigured() {
  if (!getPayFastMerchantId() || !getPayFastMerchantKey()) {
    throw new Error("PayFast merchant configuration missing")
  }
  if (!env.PAYFAST_NOTIFY_URL || !env.PAYFAST_RETURN_URL || !env.PAYFAST_CANCEL_URL) {
    throw new Error("PayFast callback URLs are not configured")
  }
}

export function buildPayFastCheckout(args: PayFastCheckoutArgs) {
  ensurePayFastConfigured()

  const itemName =
    args.plan === "PRO"
      ? "TenderLens Professional"
      : "TenderLens Business"
  const amount = amountToString(args.amountCents)
  const fields = {
    merchant_id: getPayFastMerchantId(),
    merchant_key: getPayFastMerchantKey(),
    return_url: args.returnUrl ?? env.PAYFAST_RETURN_URL,
    cancel_url: args.cancelUrl ?? env.PAYFAST_CANCEL_URL,
    notify_url: env.PAYFAST_NOTIFY_URL,
    name_first: args.firstName,
    name_last: args.lastName,
    email_address: args.email,
    m_payment_id: args.reference,
    amount,
    item_name: itemName,
    item_description: `${itemName} monthly subscription for ${args.orgName}`,
    subscription_type: "1",
    billing_date: getBillingDate(),
    recurring_amount: amount,
    frequency: "3",
    cycles: "0",
    custom_str1: args.plan,
    custom_str2: args.orgId,
    custom_str3: args.userId,
  }

  return {
    paymentUrl: getProcessUrl(),
    fields: env.PAYFAST_SANDBOX
      ? fields
      : {
          ...fields,
          signature: createSignatureFromEntries(
            Object.entries(fields).map(([key, value]) => [key, String(value)]),
          ),
        },
  }
}

export function verifyPayFastSignature(payload: PayFastNotifyPayload) {
  const signature = String(payload.signature ?? "")
  const computed = createSignatureFromEntries(
    Object.entries(payload).map(([key, value]) => [key, String(value)]),
  )
  return signature.length > 0 && signature === computed
}

export async function verifyPayFastPaymentWithGateway(
  payload: PayFastNotifyPayload,
) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(payload)) {
    body.append(key, value)
  }

  const response = await fetch(getValidateUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  const text = (await response.text()).trim()
  return text === "VALID"
}

export function parsePayFastNotifyPayload(input: unknown): PayFastNotifyPayload {
  const out: PayFastNotifyPayload = {}
  if (!input || typeof input !== "object") return out

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = String(value[0] ?? "")
    } else if (value != null) {
      out[key] = String(value)
    }
  }

  return out
}
