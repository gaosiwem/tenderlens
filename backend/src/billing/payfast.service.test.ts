import { beforeEach, describe, expect, it, vi } from "vitest"

const env = {
  PAYFAST_MERCHANT_ID: "merchant-id",
  PAYFAST_MERCHANT_KEY: "merchant-key",
  PAYFAST_PASSPHRASE: "passphrase",
  PAYFAST_SANDBOX: true,
  PAYFAST_RETURN_URL: "https://app.example.com/billing/success",
  PAYFAST_CANCEL_URL: "https://app.example.com/billing/cancel",
  PAYFAST_NOTIFY_URL: "https://api.example.com/api/v1/billing/payfast/notify",
}

vi.mock("../config/env", () => ({ env }))

describe("buildPayFastCheckout", () => {
  beforeEach(() => {
    env.PAYFAST_SANDBOX = true
  })

  it("uses the PayFast sandbox process URL while sandbox mode is enabled", async () => {
    const { buildPayFastCheckout } = await import("./payfast.service")

    const checkout = buildPayFastCheckout({
      orgId: "org-1",
      userId: "user-1",
      plan: "PRO",
      amountCents: 19900,
      email: "buyer@example.com",
      firstName: "Buyer",
      lastName: "Example",
      reference: "checkout-reference",
      orgName: "Example Org",
    })

    expect(checkout.paymentUrl).toBe("https://sandbox.payfast.co.za/eng/process")
    expect(checkout.fields).toHaveProperty("signature")
  })

  it("uses the PayFast production process URL only after sandbox mode is disabled", async () => {
    env.PAYFAST_SANDBOX = false
    const { buildPayFastCheckout } = await import("./payfast.service")

    const checkout = buildPayFastCheckout({
      orgId: "org-1",
      userId: "user-1",
      plan: "BUSINESS",
      amountCents: 49900,
      email: "buyer@example.com",
      firstName: "Buyer",
      lastName: "Example",
      reference: "checkout-reference",
      orgName: "Example Org",
    })

    expect(checkout.paymentUrl).toBe("https://www.payfast.co.za/eng/process")
    expect(checkout.fields).toHaveProperty("signature")
  })
})
