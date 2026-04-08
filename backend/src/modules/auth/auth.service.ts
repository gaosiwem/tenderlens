import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import {
  hashPassword,
  verifyPassword,
  randomToken,
  sha256,
} from "../../utils/crypto"
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt"
import { env } from "../../config/env"
import { sendEmail } from "../notifications/email.sender"
import {
  buildEmailVerificationContent,
  buildPasswordResetContent,
} from "../notifications/auth-email.builder"
import { OAuth2Client } from "google-auth-library"
import { logger } from "../../utils/logger"
import { syncOwnerTrialSubscriptions } from "../../billing/accountTrial.service"

const googleClient = new OAuth2Client()

async function createSession(userId: string) {
  const refreshTokenId = randomToken(16)
  const refreshJwt = signRefreshToken(userId, refreshTokenId)
  const refreshHash = sha256(refreshJwt)

  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  )
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshHash,
      expiresAt,
    },
  })

  return {
    accessToken: signAccessToken(userId),
    refreshToken: refreshJwt,
    refreshExpiresAt: expiresAt,
  }
}

async function createEmailVerification(userId: string) {
  const token = randomToken(32)
  const tokenHash = sha256(token)
  const expiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
  )

  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  return { token, expiresAt }
}

function emailVerificationUrl(token: string) {
  return `${env.FRONTEND_URL}/auth/verify-email?token=${encodeURIComponent(token)}`
}

function passwordResetUrl(token: string) {
  return `${env.FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(token)}`
}

async function sendEmailVerificationMessage(email: string, token: string) {
  const content = buildEmailVerificationContent({
    verifyUrl: emailVerificationUrl(token),
    expiresInHours: env.EMAIL_VERIFICATION_TTL_HOURS,
  })
  try {
    await sendEmail(email, content.subject, content.text, content.html)
  } catch (err) {
    console.warn("Email verification delivery failed", err)
  }
}

async function sendPasswordResetMessage(email: string, token: string) {
  const content = buildPasswordResetContent({
    resetUrl: passwordResetUrl(token),
    expiresInHours: env.PASSWORD_RESET_TTL_HOURS,
  })
  try {
    await sendEmail(email, content.subject, content.text, content.html)
  } catch (err) {
    console.warn("Password reset delivery failed", err)
  }
}

async function createPersonalOrgForUser(userId: string, nameOrEmail: string) {
  const org = await prisma.organization.create({
    data: {
      name: nameOrEmail,
      slug: `org-${userId.slice(0, 8)}`,
    },
  })

  await prisma.membership.create({
    data: {
      userId,
      orgId: org.id,
      role: "OWNER",
    },
  })

  await prisma.orgSubscription.create({
    data: {
      orgId: org.id,
      plan: "TRIAL" as any,
      status: "ACTIVE",
      trialEndsAt: null,
    },
  })
}

async function startPendingTrialForUser(userId: string) {
  await syncOwnerTrialSubscriptions(userId)
}

export async function registerUser(input: {
  email: string
  password: string
  name?: string
}) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  })
  if (existing) throw new AppError("CONFLICT", "Email already registered", 409)

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      emailVerifiedAt: env.EMAIL_VERIFICATION_REQUIRED ? null : new Date(),
      name: input.name ?? null,
    },
  })

  await createPersonalOrgForUser(user.id, input.name ?? input.email.split("@")[0])

  let verificationToken: string | null = null
  if (env.EMAIL_VERIFICATION_REQUIRED) {
    const { token } = await createEmailVerification(user.id)
    verificationToken = token
    await sendEmailVerificationMessage(user.email, token)
  }

  const { passwordHash, ...userWithoutPassword } = user
  return {
    user: userWithoutPassword,
    verificationToken,
  }
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user || !user.isActive)
    throw new AppError("UNAUTHORIZED", "Invalid credentials", 401)
  if (env.EMAIL_VERIFICATION_REQUIRED && !user.emailVerifiedAt) {
    throw new AppError(
      "EMAIL_NOT_VERIFIED",
      "Please verify your email before signing in.",
      403,
    )
  }

  const storedPasswordHash = user.passwordHash ?? ""
  let passwordOk = storedPasswordHash
    ? await verifyPassword(storedPasswordHash, input.password)
    : false
  if (
    !passwordOk &&
    storedPasswordHash &&
    !storedPasswordHash.startsWith("$argon2") &&
    storedPasswordHash === input.password
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password) },
    })
    passwordOk = true
  }
  if (!passwordOk)
    throw new AppError("UNAUTHORIZED", "Invalid credentials", 401)

  if (user.mustChangePassword) {
    throw new AppError(
      "PASSWORD_CHANGE_REQUIRED",
      "You must change your temporary password before signing in.",
      403,
    )
  }

  await startPendingTrialForUser(user.id)

  const session = await createSession(user.id)

  const { passwordHash, ...userWithoutPassword } = user
  return {
    user: userWithoutPassword,
    ...session,
  }
}

export async function completeInvitePassword(input: {
  email: string
  temporaryPassword: string
  newPassword: string
}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user || !user.isActive) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials", 401)
  }

  if (!user.mustChangePassword) {
    throw new AppError(
      "INVALID_STATE",
      "This account does not require an invite password change.",
      400,
    )
  }

  const storedPasswordHash = user.passwordHash ?? ""
  const tempPasswordOk = storedPasswordHash
    ? await verifyPassword(storedPasswordHash, input.temporaryPassword)
    : false

  if (!tempPasswordOk) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials", 401)
  }

  const newHash = await hashPassword(input.newPassword)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await startPendingTrialForUser(user.id)

  const session = await createSession(user.id)
  const { passwordHash, ...userWithoutPassword } = user
  return {
    user: userWithoutPassword,
    ...session,
  }
}

export async function logoutRefreshToken(refreshJwt: string) {
  const hash = sha256(refreshJwt)
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function rotateRefreshToken(refreshJwt: string) {
  let refreshClaims: { sub: string; tid: string }
  try {
    refreshClaims = verifyRefreshToken(refreshJwt)
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401)
  }

  const existingHash = sha256(refreshJwt)
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: existingHash },
  })
  if (!existing || existing.revokedAt)
    throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401)
  if (existing.expiresAt.getTime() < Date.now())
    throw new AppError("UNAUTHORIZED", "Refresh token expired", 401)

  if (existing.userId !== refreshClaims.sub) {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401)
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  })

  const newTokenId = randomToken(16)
  const newJwt = signRefreshToken(existing.userId, newTokenId)
  const newHash = sha256(newJwt)

  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  )
  await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: newHash,
      expiresAt,
    },
  })

  const access = signAccessToken(existing.userId)
  return {
    accessToken: access,
    refreshToken: newJwt,
    refreshExpiresAt: expiresAt,
  }
}

export async function createPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { ok: true as const }

  const token = randomToken(32)
  const tokenHash = sha256(token)
  const expiresAt = new Date(
    Date.now() + env.PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000,
  )

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  await sendPasswordResetMessage(email, token)

  return { ok: true as const, token }
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = sha256(token)
  const pr = await prisma.passwordReset.findUnique({ where: { tokenHash } })
  if (!pr) throw new AppError("INVALID_TOKEN", "Invalid token", 400)
  if (pr.usedAt) throw new AppError("INVALID_TOKEN", "Token already used", 400)
  if (pr.expiresAt.getTime() < Date.now())
    throw new AppError("INVALID_TOKEN", "Token expired", 400)

  const newHash = await hashPassword(newPassword)

  await prisma.$transaction([
    prisma.passwordReset.update({
      where: { id: pr.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: pr.userId },
      data: { passwordHash: newHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: pr.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  return { ok: true as const }
}

export async function verifyEmailToken(token: string) {
  const tokenHash = sha256(token)
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  })
  if (!row) throw new AppError("INVALID_TOKEN", "Invalid token", 400)
  if (row.usedAt) throw new AppError("INVALID_TOKEN", "Token already used", 400)
  if (row.expiresAt.getTime() < Date.now())
    throw new AppError("INVALID_TOKEN", "Token expired", 400)

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ])

  return { ok: true as const }
}

export async function resendEmailVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { ok: true as const }
  if (user.emailVerifiedAt) return { ok: true as const }

  const { token } = await createEmailVerification(user.id)
  await sendEmailVerificationMessage(user.email, token)
  return { ok: true as const }
}

export async function loginWithGoogle(input: { credential: string }) {
  if (!env.GOOGLE_CLIENT_ID) {
    logger.error({
      event: "auth.google.config_missing",
      hasCredential: Boolean(input.credential),
      credentialLength: input.credential.length,
    }, "Google login failed because GOOGLE_CLIENT_ID is missing.")
    throw new AppError("CONFIG_ERROR", "GOOGLE_CLIENT_ID missing", 500)
  }

  let ticket
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: input.credential,
      audience: env.GOOGLE_CLIENT_ID,
    })
  } catch (error) {
    logger.warn(
      {
        event: "auth.google.verify_failed",
        credentialLength: input.credential.length,
        configuredAudience: env.GOOGLE_CLIENT_ID,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : { message: "Unknown Google verification error" },
      },
      "Google ID token verification failed.",
    )
    throw new AppError(
      "GOOGLE_TOKEN_REJECTED",
      "Google sign-in token was rejected. Verify the OAuth client allows this origin and try again.",
      401,
    )
  }
  const payload = ticket.getPayload()
  const email = payload?.email?.trim().toLowerCase()
  const googleId = payload?.sub
  if (!email || !googleId) {
    logger.warn(
      {
        event: "auth.google.invalid_payload",
        credentialLength: input.credential.length,
        hasEmail: Boolean(email),
        hasGoogleId: Boolean(googleId),
      },
      "Google login payload is missing required identity fields.",
    )
    throw new AppError(
      "GOOGLE_INVALID_PAYLOAD",
      "Google sign-in returned an incomplete identity payload. Please try again.",
      401,
    )
  }

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        googleId,
        emailVerifiedAt: new Date(),
        name: payload?.name ?? null,
        avatarUrl: payload?.picture ?? null,
        passwordHash: null,
      },
    })
    await createPersonalOrgForUser(user.id, user.name ?? email.split("@")[0])
  } else {
    if (user.googleId && user.googleId !== googleId) {
      logger.warn(
        {
          event: "auth.google.account_mismatch",
          email,
          existingUserId: user.id,
        },
        "Google login rejected because the account is linked to a different Google identity.",
      )
      throw new AppError("UNAUTHORIZED", "Google account mismatch", 401)
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        avatarUrl: user.avatarUrl ?? payload?.picture ?? null,
        name: user.name ?? payload?.name ?? null,
      },
    })
  }

  if (!user.isActive) {
    logger.warn(
      {
        event: "auth.google.inactive_user",
        email,
        userId: user.id,
      },
      "Google login rejected because the user is inactive.",
    )
    throw new AppError("UNAUTHORIZED", "Invalid user", 401)
  }

  await startPendingTrialForUser(user.id)

  const session = await createSession(user.id)
  const { passwordHash, ...userWithoutPassword } = user
  return {
    user: userWithoutPassword,
    ...session,
  }
}
