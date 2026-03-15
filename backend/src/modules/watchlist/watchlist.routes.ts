import { Router } from "express"
import { z } from "zod"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { AppError, ok } from "../../utils/responses"
import {
  addToWatchlist,
  removeFromWatchlist,
  listWatchlist,
  isWatched,
  bulkRemoveFromWatchlist,
  updateWatchlistItem,
  WATCHLIST_REMINDER_TYPES,
  WATCHLIST_NOTIFICATION_CHANNELS,
} from "./watchlist.service"

export const watchlistRouter = Router()
const addWatchSchema = z.object({
  templateId: z.string().min(1).optional(),
})

watchlistRouter.get(
  "/",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const items = await listWatchlist({
        orgId: req.orgId!,
        userId: req.auth!.userId,
      })
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

watchlistRouter.get(
  "/:tenderId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const tenderId = String(req.params.tenderId)
      const watched = await isWatched({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        tenderId,
      })
      res.json(ok({ watched }))
    } catch (e) {
      next(e)
    }
  },
)

watchlistRouter.post(
  "/:tenderId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const tenderId = String(req.params.tenderId)
      const body = addWatchSchema.parse(req.body ?? {})
      const out = await addToWatchlist({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        tenderId,
        templateId: body.templateId,
      })
      res.json(ok(out))
    } catch (e: any) {
      if (e?.name === "ZodError") {
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      }
      next(e)
    }
  },
)

watchlistRouter.delete(
  "/:tenderId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const tenderId = String(req.params.tenderId)
      const out = await removeFromWatchlist({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        tenderId,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

const bulkRemoveSchema = z.object({
  tenderIds: z.array(z.string()).min(1),
})

watchlistRouter.post(
  "/bulk-remove",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const body = bulkRemoveSchema.parse(req.body ?? {})
      const out = await bulkRemoveFromWatchlist({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        tenderIds: body.tenderIds,
      })
      res.json(ok(out))
    } catch (e: any) {
      if (e?.name === "ZodError") {
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      }
      next(e)
    }
  },
)

const updateNotesSchema = z.object({
  notes: z.string().max(2000).optional(),
  reminderTypes: z
    .array(z.enum(WATCHLIST_REMINDER_TYPES))
    .max(WATCHLIST_REMINDER_TYPES.length)
    .optional(),
  notificationChannels: z
    .array(z.enum(WATCHLIST_NOTIFICATION_CHANNELS))
    .min(1)
    .max(WATCHLIST_NOTIFICATION_CHANNELS.length)
    .optional(),
})

watchlistRouter.patch(
  "/:tenderId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const tenderId = String(req.params.tenderId)
      const body = updateNotesSchema.parse(req.body ?? {})
      const out = await updateWatchlistItem({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        tenderId,
        notes: body.notes,
        reminderTypes: body.reminderTypes,
        notificationChannels: body.notificationChannels,
      })
      res.json(ok(out))
    } catch (e: any) {
      if (e?.name === "ZodError") {
        return next(
          new AppError("VALIDATION_ERROR", "Invalid input", 400, e.flatten()),
        )
      }
      next(e)
    }
  },
)
