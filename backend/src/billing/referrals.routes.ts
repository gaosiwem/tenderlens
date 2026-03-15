import { Router } from "express"
import crypto from "crypto"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { ok } from "../utils/responses"

export const referralsRouter = Router()

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase() // 6 chars
}

referralsRouter.post(
  "/generate",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      // Check if one exists for this user/org?
      // Sprint 3: "generate referral code per org or per user"
      // Let's do per user for now as the schema has both.

      // Check existing for this user
      let existing = await prisma.referralCode.findFirst({
        where: { userId: req.auth!.userId },
      })

      if (existing) {
        res.json(ok({ code: existing.code }))
        return
      }

      let code = makeCode()
      // ensure uniqueness
      while (await prisma.referralCode.findUnique({ where: { code } })) {
        code = makeCode()
      }

      const row = await prisma.referralCode.create({
        data: {
          orgId: req.orgId!,
          userId: req.auth!.userId,
          code,
          active: true,
        },
      })
      res.json(ok({ code: row.code }))
    } catch (e) {
      next(e)
    }
  },
)

referralsRouter.get(
  "/summary",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      // Admin only? Or anyone? Let's allow any member to see org referrals for now.
      const since = new Date(Date.now() - 30 * 24 * 60 * 60_000)

      // Find codes for this org
      const orgCodes = await prisma.referralCode.findMany({
        where: { orgId: req.orgId! },
        select: { code: true },
      })
      const codeList = orgCodes.map((c) => c.code)

      if (codeList.length === 0) {
        res.json(ok({ items: [] }))
        return
      }

      const items = await prisma.referralAttribution.findMany({
        where: { code: { in: codeList }, createdAt: { gte: since } },
        take: 200,
        orderBy: { createdAt: "desc" },
      })

      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)
