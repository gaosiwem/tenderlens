import { Server } from "socket.io"
import http from "http"
import { env } from "../config/env"

export function initSocket(server: http.Server) {
  if (!env.SOCKET_ENABLED) return null

  const io = new Server(server, {
    path: env.SOCKET_PATH,
    cors: { origin: env.SOCKET_CORS_ORIGIN, credentials: true },
  })

  io.on("connection", (socket: any) => {
    socket.on(
      "workspace:join",
      (payload: { workspaceId?: string; tenderId?: string }) => {
        const room = payload.workspaceId
          ? `ws:${payload.workspaceId}`
          : payload.tenderId
            ? `tender:${payload.tenderId}`
            : null
        if (room) socket.join(room)
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
