import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { NotificationType } from "../models/notificationSchema.js";
import jwt from "jsonwebtoken";

let io: Server | null = null;

// Map userId -> Set of socket IDs (a user can have multiple tabs)
const userSockets = new Map<string, Set<string>>();

/**
 * Initialise Socket.IO and attach it to the HTTP server.
 * Call this once from index.ts after creating the http server.
 */
export function initSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "https://product-hunt-admin.netlify.app",
            "https://product-hunt-frontend.netlify.app",
          ],
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // ── Authentication middleware ────────────────────────────────────────────
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "secret-key"
      ) as { id: string; email: string };
      (socket as any).userId = decoded.id;
      next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  // ── Connection handling ─────────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    const userId: string = (socket as any).userId;
    const activeConnections = (userSockets.get(userId)?.size || 0) + 1;
    console.log(
      `[Socket.IO] User ${userId} connected (socket=${socket.id}, active=${activeConnections})`
    );

    // Track socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Join a personal room so we can send targeted notifications
    socket.join(`user:${userId}`);
    console.log(`[Socket.IO] User ${userId} joined room user:${userId}`);

    // ── Listen for a manual room-join (useful for client re-registration) ──
    socket.on("register", (data: { userId?: string }) => {
      const joinId = data?.userId || userId;
      socket.join(`user:${joinId}`);
      console.log(`[Socket.IO] User ${joinId} re-registered and joined room user:${joinId}`);
    });

    socket.on("disconnect", (reason: string) => {
      const remaining = userSockets.get(userId);
      const stillActive = remaining ? remaining.size - 1 : 0;
      console.log(
        `[Socket.IO] User ${userId} disconnected (socket=${socket.id}, reason=${reason}, remaining=${stillActive})`
      );
      if (remaining) {
        remaining.delete(socket.id);
        if (remaining.size === 0) userSockets.delete(userId);
      }
    });

    socket.on("connect_error", (err: Error) => {
      console.error(`[Socket.IO] Connection error for user ${userId}:`, err.message);
    });
  });

  console.log("[Socket.IO] Initialised");
  return io;
}

/**
 * Get the Socket.IO server instance.
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Send a real-time notification event to a specific user.
 * Safe to call even if the user is offline — it simply won't deliver.
 */
export function emitNotification(
  recipientId: string,
  payload: {
    _id: string;
    type: NotificationType;
    message: string;
    actor: { _id: string; fullname: string; username: string; profileImage?: string };
    entityId?: string;
    entityType?: "product" | "comment" | "review" | "user";
    link?: string;
    read: boolean;
    createdAt: string;
  }
): void {
  if (!io) {
    console.warn(`[Socket.IO] emitNotification skipped — io not initialized (recipient=${recipientId})`);
    return;
  }
  const room = `user:${recipientId}`;
  const roomSockets = io.sockets?.adapter?.rooms?.get(room);
  const recipientCount = roomSockets ? roomSockets.size : 0;
  io.to(room).emit("notification:new", payload);
  console.log(
    `[Socket.IO] Emitted "notification:new" to ${room} (type=${payload.type}, recipientSockets=${recipientCount})`
  );
}

/**
 * Broadcast the updated unread count to a user (useful after mark-all-read etc.)
 */
export function emitUnreadCount(recipientId: string, count: number): void {
  if (!io) {
    console.warn(`[Socket.IO] emitUnreadCount skipped — io not initialized (recipient=${recipientId})`);
    return;
  }
  const room = `user:${recipientId}`;
  io.to(room).emit("notification:unread-count", { count });
  console.log(`[Socket.IO] Emitted "notification:unread-count" to ${room} (count=${count})`);
}
