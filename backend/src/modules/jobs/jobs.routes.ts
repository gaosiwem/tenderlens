import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { ok, AppError } from "../../utils/responses"

export const jobsRouter = Router()

jobsRouter.get(
  "/:jobId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const job = await prisma.processingJob.findFirst({
        where: { id: req.params.jobId, orgId: req.orgId! },
      })
      if (!job) throw new AppError("NOT_FOUND", "Job not found", 404)
      res.json(ok(job))
    } catch (e) {
      next(e)
    }
  },
)
