import jwt from "jsonwebtoken"
import { env } from "../config/env"

export type AccessClaims = { sub: string }
export type RefreshClaims = { sub: string; tid: string }

export function signAccessToken(userId: string) {
  const ttl = env.JWT_ACCESS_TTL_MINUTES * 60
  return jwt.sign({ sub: userId } satisfies AccessClaims, env.JWT_ACCESS_SECRET, { expiresIn: ttl })
}

export function signRefreshToken(userId: string, tokenId: string) {
  const ttl = env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60
  return jwt.sign({ sub: userId, tid: tokenId } satisfies RefreshClaims, env.JWT_REFRESH_SECRET, { expiresIn: ttl })
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims
}