import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { embedQuery } from "../embeddings/embeddings"

export const searchRouter = Router()

searchRouter.get(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const q = String(req.query.q ?? "").trim()
      if (!q) throw new AppError("VALIDATION_ERROR", "Missing q", 400)

      const limit = Math.min(
        25,
        Number(req.query.limit ?? env.SEARCH_LIMIT_DEFAULT),
      )
      const orgId = req.orgId!

      const v = await embedQuery(q)
      if (!v.length) {
        return res.json(ok({ items: [], note: "Embeddings disabled" }))
      }

      // We use a raw query because Prisma doesn't natively support vector similarity in findMany yet (as of standard client)
      // or at least not with the <=> operator easily without extensions.
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
      SELECT
        c.id,
        c."tenderId",
        c."tenderFileId",
        c.index,
        c.content,
        1 - (c.embedding <=> $1::vector) AS score
      FROM "TenderChunk" c
      WHERE c."orgId" = $2
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $3
      `,
        `[${v.join(",")}]`,
        orgId,
        limit,
      )

      res.json(ok({ items: rows }))
    } catch (e) {
      next(e)
    }
  },
)
