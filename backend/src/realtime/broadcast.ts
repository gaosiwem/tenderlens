import { initSocket } from "./socket"

let io: any = null

export function setIO(instance: any) {
  io = instance
}

export function getIo() {
  return io
}

export function emitWorkspace(workspaceId: string, event: string, data: any) {
  if (!io) return
  io.to(`ws:${workspaceId}`).emit(event, data)
}

export function emitTender(tenderId: string, event: string, data: any) {
  if (!io) return
  io.to(`tender:${tenderId}`).emit(event, data)
}
