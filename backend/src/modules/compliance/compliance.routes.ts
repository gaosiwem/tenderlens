import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import {
  getComplianceAudit,
  listComplianceAudits,
  rerunComplianceAudit,
  startComplianceAudit,
} from "./compliance.service"

export const complianceRouter = Router()

complianceRouter.post(
  "/tenders/:tenderId/compliance-audits",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const audit = await startComplianceAudit({
        orgId: req.orgId!,
        tenderId: String(req.params.tenderId),
        userId: req.auth!.userId,
      })
      res.json(ok({ audit }))
    } catch (error) {
      next(error)
    }
  },
)

complianceRouter.get(
  "/tenders/:tenderId/compliance-audits",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const items = await listComplianceAudits({
        orgId: req.orgId!,
        tenderId: String(req.params.tenderId),
      })
      res.json(ok({ items }))
    } catch (error) {
      next(error)
    }
  },
)

complianceRouter.get(
  "/compliance-audits/:auditId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const audit = await getComplianceAudit({
        orgId: req.orgId!,
        auditId: String(req.params.auditId),
      })
      res.json(ok({ audit }))
    } catch (error) {
      next(error)
    }
  },
)

complianceRouter.post(
  "/compliance-audits/:auditId/rerun",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const audit = await rerunComplianceAudit({
        orgId: req.orgId!,
        auditId: String(req.params.auditId),
        userId: req.auth!.userId,
      })
      res.json(ok({ audit }))
    } catch (error) {
      next(error)
    }
  },
)
