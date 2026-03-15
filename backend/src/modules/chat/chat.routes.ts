import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok } from "../../utils/responses"
import { auditLog } from "../audit/audit.service"
import {
  createConversation,
  listConversations,
  getConversation,
  getConversationContextProgress,
  postMessage,
  streamMessage,
} from "./chat.service"
import { enforceTrial } from "../../billing/plan.middleware"
import { incrementUsage } from "../../billing/usage.service"

import { z } from "zod"

const CreateConversationSchema = z.object({
  title: z.string().optional(),
  tenderId: z.string().uuid().optional(),
})

const PostMessageSchema = z.object({
  question: z
    .string()
    .min(1, "Question cannot be empty")
    .max(2000, "Question is too long (max 2000 chars)"),
})

export const chatRouter = Router()

chatRouter.post(
  "/conversations",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const { title, tenderId } = CreateConversationSchema.parse(req.body)

      const c = await createConversation({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        title,
        tenderId,
      })

      await auditLog({
        req,
        action: "CHAT_CONVO_CREATE",
        orgId: req.orgId!,
        userId: req.auth!.userId,
        entityType: "Conversation",
        entityId: c.id,
        meta: { tenderId: tenderId ?? null },
      })

      res.json(ok(c))
    } catch (e) {
      next(e)
    }
  },
)

chatRouter.get(
  "/conversations",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const items = await listConversations(req.orgId!)
      res.json(ok({ items }))
    } catch (e) {
      next(e)
    }
  },
)

chatRouter.get(
  "/conversations/:id",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const out = await getConversation(req.orgId!, req.params.id)
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

chatRouter.get(
  "/conversations/:id/context-progress",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const out = await getConversationContextProgress({
        orgId: req.orgId!,
        conversationId: req.params.id,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

chatRouter.post(
  "/conversations/:id/messages",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await incrementUsage(req.orgId!, "aiQueries", req.auth!.userId)

      const { question } = PostMessageSchema.parse(req.body)
      const out = await postMessage({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        conversationId: req.params.id,
        question,
      })

      await auditLog({
        req,
        action: "CHAT_MESSAGE",
        orgId: req.orgId!,
        userId: req.auth!.userId,
        entityType: "Conversation",
        entityId: req.params.id,
        meta: {},
      })

      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

chatRouter.post(
  "/conversations/:id/stream",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await incrementUsage(req.orgId!, "aiQueries", req.auth!.userId)

      const { question } = PostMessageSchema.parse(req.body)

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream")
      res.setHeader("Cache-Control", "no-cache")
      res.setHeader("Connection", "keep-alive")

      await streamMessage({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        conversationId: req.params.id,
        question,
        onToken: (token: string) => {
          res.write(`event: token\ndata: ${JSON.stringify({ t: token })}\n\n`)
        },
        onDone: (data: any) => {
          res.write(
            `event: done\ndata: ${JSON.stringify({ done: true, ...data })}\n\n`,
          )
          res.end()
        },
      })
    } catch (e) {
      // If we haven't started streaming yet, we can send a normal error
      if (!res.headersSent) {
        next(e)
      } else {
        res.write(
          `data: ${JSON.stringify({ error: (e as Error).message })}\n\n`,
        )
        res.end()
      }
    }
  },
)
