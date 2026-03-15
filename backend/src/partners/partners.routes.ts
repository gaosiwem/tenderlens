import { Router } from "express"
import crypto from "crypto"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { ok, AppError } from "../utils/responses"

export const partnersRouter = Router()

function makeCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase()
}

partnersRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (process.env.PARTNERS_ENABLED !== "true")
      throw new AppError("DISABLED", "Partners disabled", 400)

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
    })
    if (!user) throw new AppError("UNAUTHORIZED", "User not found", 401)

    // MVP: treat users as partners only if linked in DB manually.
    const partner = await prisma.partner.findFirst({
      where: {
        email: user.email,
        active: true,
      },
      include: {
        tier: true,
      },
    })
    res.json(ok({ partner }))
  } catch (e) {
    next(e)
  }
})

partnersRouter.post("/referral-code", requireAuth, async (req, res, next) => {
  try {
    if (process.env.PARTNERS_ENABLED !== "true")
      throw new AppError("DISABLED", "Partners disabled", 400)

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
    })
    if (!user) throw new AppError("UNAUTHORIZED", "User not found", 401)

    const partner = await prisma.partner.findFirst({
      where: { email: user.email, active: true },
    })
    if (!partner) throw new AppError("FORBIDDEN", "Not a partner", 403)

    const code = makeCode()
    const row = await prisma.referralCode.create({
      data: { code, active: true, partnerId: partner.id },
    })

    res.json(ok({ code: row.code }))
  } catch (e) {
    next(e)
  }
})
