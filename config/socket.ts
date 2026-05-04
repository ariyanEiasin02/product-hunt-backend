import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
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
        : ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
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
    console.log(`[Socket.IO] User ${userId} connected (${socket.id})`);

    // Track socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Join a personal room so we can send targeted notifications
    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] User ${userId} disconnected (${socket.id})`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
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
    type: string;
    message: string;
    actor: { _id: string; fullname: string; username: string; profileImage?: string };
    entityId?: string;
    entityType?: string;
    link?: string;
    read: boolean;
    createdAt: string;
  }
): void {
  if (!io) return;
  io.to(`user:${recipientId}`).emit("notification:new", payload);
}

/**
 * Broadcast the updated unread count to a user (useful after mark-all-read etc.)
 */
export function emitUnreadCount(recipientId: string, count: number): void {
  if (!io) return;
  io.to(`user:${recipientId}`).emit("notification:unread-count", { count });
}
