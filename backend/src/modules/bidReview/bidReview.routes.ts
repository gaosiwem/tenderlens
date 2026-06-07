import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import {
  getBidReview,
  listBidReviews,
  rerunBidReview,
  startBidReview,
} from "./bidReview.service"

export const bidReviewRouter = Router()

function proposalFileIdsFromBody(body: unknown) {
  const raw =
    body && typeof body === "object" && "proposalFileIds" in body
      ? (body as { proposalFileIds?: unknown }).proposalFileIds
      : undefined
  if (!Array.isArray(raw)) return undefined
  return raw.map((item) => String(item).trim()).filter(Boolean)
}

bidReviewRouter.post(
  "/tenders/:tenderId/bid-reviews",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const review = await startBidReview({
        orgId: req.orgId!,
        tenderId: String(req.params.tenderId),
        userId: req.auth!.userId,
        proposalFileIds: proposalFileIdsFromBody(req.body),
      })
      res.json(ok({ review }))
    } catch (error) {
      next(error)
    }
  },
)

bidReviewRouter.get(
  "/tenders/:tenderId/bid-reviews",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const items = await listBidReviews({
        orgId: req.orgId!,
        tenderId: String(req.params.tenderId),
      })
      res.json(ok({ items }))
    } catch (error) {
      next(error)
    }
  },
)

bidReviewRouter.get(
  "/bid-reviews/:reviewId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const review = await getBidReview({
        orgId: req.orgId!,
        reviewId: String(req.params.reviewId),
      })
      res.json(ok({ review }))
    } catch (error) {
      next(error)
    }
  },
)

bidReviewRouter.post(
  "/bid-reviews/:reviewId/rerun",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const review = await rerunBidReview({
        orgId: req.orgId!,
        reviewId: String(req.params.reviewId),
        userId: req.auth!.userId,
      })
      res.json(ok({ review }))
    } catch (error) {
      next(error)
    }
  },
)
