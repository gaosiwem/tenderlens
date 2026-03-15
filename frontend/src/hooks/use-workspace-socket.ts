"use client";

import * as React from "react";
import { io, Socket } from "socket.io-client";

export function useWorkspaceSocket(
  workspaceId: string | null,
  onEvent: (event: string, data: unknown) => void,
) {
  const socketRef = React.useRef<Socket | null>(null);

  React.useEffect(() => {
    if (!workspaceId) return;

    // Ensure we connect to the right URL. The backend might be on a different port in dev.
    // Assuming /socket.io is proxied or absolute path is needed.
    // For now, let's try relative path if checking backend locally.
    const socket = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
      {
        path: "/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
      },
    );

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

    return () => {
      socket.emit("workspace:leave", { workspaceId });
      socket.disconnect();
    };
  }, [workspaceId, onEvent]);
}
