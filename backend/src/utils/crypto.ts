import crypto from "crypto"
import argon2 from "argon2"

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex")
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}
