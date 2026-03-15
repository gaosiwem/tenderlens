import crypto from "crypto"

export function generateOtp() {
  const n = crypto.randomInt(100000, 999999)
  return String(n)
}

export function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex")
}
