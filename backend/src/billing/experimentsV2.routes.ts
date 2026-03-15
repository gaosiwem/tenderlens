import { Router } from "express"
import { prisma } from "../db/prisma"
import { requireAuth } from "../middleware/auth.middleware"
import { requireOrgMembership } from "../middleware/tenant.middleware"
import { ok } from "../utils/responses"
import { resolveExperimentsForOrg } from "./experimentTargeting.service"
import { getExperimentBucket } from "./experiments.service"

export const experimentsV2Router = Router()

experimentsV2Router.get(
  "/experiments/resolve",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const experiments = await resolveExperimentsForOrg(req.orgId!)
      res.json(ok({ experiments }))
    } catch (e) {
      next(e)
    }
  },
)

/**
 * Returns variant config payloads for UI consumption
 */
experimentsV2Router.get(
  "/experiments/config",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      if (process.env.EXPERIMENTS_V2_ENABLED !== "true") {
        return res.json(ok({ items: [] }))
      }

      const configs = await prisma.experimentConfig.findMany({
        where: { enabled: true },
        take: 20,
      })

      const out = []

      for (const c of configs) {
        const assign = await getExperimentBucket(req.orgId!, c.key)
        out.push({
          key: c.key,
          bucket: assign.bucket,
          config: c.config,
        })
      }

      res.json(ok({ items: out }))
    } catch (e) {
      next(e)
    }
  },
)
