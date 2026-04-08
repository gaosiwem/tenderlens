import { Server } from "socket.io"
import http from "http"
import { env } from "../config/env"
import { prisma } from "../db/prisma"
import { verifyAccessToken } from "../utils/jwt"

async function canJoinWorkspace(userId: string, workspaceId: string) {
  const workspace = await prisma.bidWorkspace.findFirst({
    where: { id: workspaceId },
    select: { orgId: true },
  })

  if (!workspace) return false

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId,
        orgId: workspace.orgId,
      },
    },
  })

  return Boolean(membership)
}

async function canJoinTender(userId: string, tenderId: string) {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId },
    select: { orgId: true },
  })

  if (!tender) return false

  if (!tender.orgId) {
    const membership = await prisma.membership.findFirst({
      where: { userId },
      select: { id: true },
    })
    return Boolean(membership)
  }

  const orgMembership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId,
        orgId: tender.orgId,
      },
    },
  })

  return Boolean(orgMembership)
}

export function initSocket(server: http.Server) {
  if (!env.SOCKET_ENABLED) return null

  const io = new Server(server, {
    path: env.SOCKET_PATH,
    cors: { origin: env.SOCKET_ALLOWED_ORIGINS, credentials: true },
  })

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token ?? "").trim()
      if (!token) {
        return next(new Error("Unauthorized"))
      }

      const claims = verifyAccessToken(token)
      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, isActive: true },
      })

      if (!user || !user.isActive) {
        return next(new Error("Unauthorized"))
      }

      socket.data.userId = user.id
      next()
    } catch {
      next(new Error("Unauthorized"))
    }
  })

  io.on("connection", (socket: any) => {
    const userId = String(socket.data.userId || "")

    socket.on(
      "workspace:join",
      async (payload: { workspaceId?: string; tenderId?: string }) => {
        const workspaceId = payload.workspaceId?.trim()
        const tenderId = payload.tenderId?.trim()
        const room = payload.workspaceId
          ? `ws:${payload.workspaceId}`
          : payload.tenderId
            ? `tender:${payload.tenderId}`
            : null

        if (!room || !userId) return

        const allowed = workspaceId
          ? await canJoinWorkspace(userId, workspaceId)
          : tenderId
            ? await canJoinTender(userId, tenderId)
            : false

        if (!allowed) {
          socket.emit("workspace:error", { message: "Unauthorized room access" })
          return
        }

        socket.join(room)
      },
    )

    socket.on(
      "workspace:leave",
      (payload: { workspaceId?: string; tenderId?: string }) => {
        const room = payload.workspaceId
          ? `ws:${payload.workspaceId}`
          : payload.tenderId
            ? `tender:${payload.tenderId}`
            : null
        if (room) socket.leave(room)
      },
    )
  })

  return io
}
