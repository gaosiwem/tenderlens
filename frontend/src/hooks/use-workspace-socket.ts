"use client";

import * as React from "react";
import { io, Socket } from "socket.io-client";
import { baseUrl, ensureAccessToken } from "@/lib/api";

export function useWorkspaceSocket(
  workspaceId: string | null,
  onEvent: (event: string, data: unknown) => void,
) {
  const socketRef = React.useRef<Socket | null>(null);

  React.useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function connect() {
      const { token } = await ensureAccessToken();
      if (!token || cancelled) return;

      const socket = io(baseUrl, {
        path: "/socket.io",
        auth: { token },
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("workspace:join", { workspaceId });
      });

      const events = [
        "task:created",
        "task:updated",
        "task:commented",
        "attachment:added",
        "workspace:updated",
      ];
      for (const ev of events) {
        socket.on(ev, (data) => onEvent(ev, data));
      }
    }
    void connect();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.emit("workspace:leave", { workspaceId });
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [workspaceId, onEvent]);
}
