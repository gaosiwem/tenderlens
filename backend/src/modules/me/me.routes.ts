import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { prisma } from "../../db/prisma"
import { ok } from "../../utils/responses"

export const meRouter = Router()

meRouter.get("/", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      emailVerifiedAt: true,
    }
  })

  const memberships = await prisma.membership.findMany({
    where: { userId: req.auth!.userId },
    include: { org: true }
  })

  res.json(
    ok({
      user,
      orgs: memberships.map((m) => ({ org: m.org, role: m.role }))
    })
  )
})
