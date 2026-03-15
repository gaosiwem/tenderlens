import { Router } from "express"
import cookieParser from "cookie-parser"
import { ok, AppError } from "../../utils/responses"
import { authLimiter } from "../../middleware/rateLimit.middleware"
import {
  registerSchema,
  loginSchema,
  requestResetSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  googleLoginSchema,
  resetPasswordSchema,
} from "./auth.schemas"
import {
  registerUser,
  loginUser,
  logoutRefreshToken,
  rotateRefreshToken,
  createPasswordReset,
  verifyEmailToken,
  resendEmailVerification,
  loginWithGoogle,
  resetPassword,
} from "./auth.service"
import { auditLog } from "../audit/audit.service"
import { env } from "../../config/env"
import { logger } from "../../utils/logger"

const REFRESH_COOKIE = "tl_refresh"

export const authRouter = Router()
authRouter.use(cookieParser())

function setRefreshCookie(res: any, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/api/v1/auth",
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
}

function clearRefreshCookie(res: any) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/api/v1/auth",
  })
}

authRouter.post("/register", authLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)
    const out = await registerUser(body)

    await auditLog({
      req,
      action: "AUTH_REGISTER",
      userId: out.user.id,
      meta: { email: out.user.email },
    })

    res.json(
      ok({
        id: out.user.id,
        email: out.user.email,
        name: out.user.name,
        devVerificationToken:
          env.NODE_ENV !== "production" ? out.verificationToken : null,
      }),
    )
  } catch (e: any) {
    if (e?.name === "ZodError")
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    next(e)
  }
})

authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body)
    const out = await loginUser(body)

    setRefreshCookie(res, out.refreshToken)

    await auditLog({
      req,
      action: "AUTH_LOGIN",
      userId: out.user.id,
      meta: { email: out.user.email },
    })

    res.json(ok({ accessToken: out.accessToken }))
  } catch (e: any) {
    if (e?.name === "ZodError")
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    next(e)
  }
})

authRouter.post("/google", authLimiter, async (req, res, next) => {
  try {
    const body = googleLoginSchema.parse(req.body)
    const out = await loginWithGoogle(body)
    setRefreshCookie(res, out.refreshToken)

    await auditLog({
      req,
      action: "AUTH_LOGIN_GOOGLE",
      userId: out.user.id,
      meta: { email: out.user.email },
    })

    res.json(ok({ accessToken: out.accessToken }))
  } catch (e: any) {
    if (e instanceof AppError) {
      return next(e)
    }
    
    logger.warn(
      {
        event: "auth.google.request_failed",
        origin: req.get("origin") ?? null,
        referer: req.get("referer") ?? null,
        ip: req.ip,
        credentialLength:
          typeof req.body?.credential === "string"
            ? req.body.credential.length
            : 0,
        errorCode: e?.code ?? null,
        errorMessage: e?.message ?? "Unknown Google auth route error",
      },
      "Google auth request failed.",
    )

    if (e?.name === "ZodError")
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )

    next(
      new AppError(
        "GOOGLE_AUTH_FAILED",
        "Google sign-in could not be completed. Verify the Google OAuth client configuration and try again.",
        500,
      ),
    )
  }
})

authRouter.post("/logout", async (req, res, next) => {
  try {
    const refresh = req.cookies?.[REFRESH_COOKIE]
    if (refresh) await logoutRefreshToken(refresh)
    clearRefreshCookie(res)

    await auditLog({ req, action: "AUTH_LOGOUT" })
    res.json(ok({}))
  } catch (e) {
    next(e)
  }
})

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refresh = req.cookies?.[REFRESH_COOKIE]
    if (!refresh)
      throw new AppError("UNAUTHORIZED", "Missing refresh token", 401)

    const rotated = await rotateRefreshToken(refresh)
    setRefreshCookie(res, rotated.refreshToken)

    await auditLog({ req, action: "AUTH_REFRESH" })
    res.json(ok({ accessToken: rotated.accessToken }))
  } catch (e) {
    next(e)
  }
})

authRouter.post(
  "/request-password-reset",
  authLimiter,
  async (req, res, next) => {
    try {
      const body = requestResetSchema.parse(req.body)
      const out = await createPasswordReset(body.email)

      await auditLog({
        req,
        action: "AUTH_PASSWORD_RESET_REQUEST",
        meta: { email: body.email },
      })

      res.json(
        ok({
          message: "If that email exists, a reset link has been sent.",
          devToken: env.NODE_ENV !== "production" ? (out.token ?? null) : null,
        }),
      )
    } catch (e: any) {
      if (e?.name === "ZodError")
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      next(e)
    }
  },
)

authRouter.post("/verify-email", authLimiter, async (req, res, next) => {
  try {
    const body = verifyEmailSchema.parse(req.body)
    await verifyEmailToken(body.token)

    await auditLog({
      req,
      action: "AUTH_EMAIL_VERIFIED",
    })

    res.json(ok({}))
  } catch (e: any) {
    if (e?.name === "ZodError")
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    next(e)
  }
})

authRouter.post("/resend-verification", authLimiter, async (req, res, next) => {
  try {
    const body = resendVerificationSchema.parse(req.body)
    await resendEmailVerification(body.email)

    await auditLog({
      req,
      action: "AUTH_EMAIL_VERIFICATION_RESENT",
      meta: { email: body.email },
    })

    res.json(ok({}))
  } catch (e: any) {
    if (e?.name === "ZodError")
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    next(e)
  }
})

authRouter.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const body = resetPasswordSchema.parse(req.body)
    await resetPassword(body.token, body.newPassword)

    await auditLog({ req, action: "AUTH_PASSWORD_RESET_COMPLETE" })

    res.json(ok({}))
  } catch (e: any) {
    if (e?.name === "ZodError")
      return next(
        new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
      )
    next(e)
  }
})
