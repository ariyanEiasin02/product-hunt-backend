import express, { Application, NextFunction, Request, Response } from "express";
import http from "http";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import router from "./routes/index.js";
import { createUploadDirectories } from "./utils/fileUploadHelper.js";
import { initSocketIO } from "./config/socket.js";
import { initCloudinary } from "./config/cloudinary.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { cacheStats } from "./utils/cache.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables FIRST — everything below depends on them
dotenv.config({ quiet: true });

// ── Process-level crash guards ──────────────────────────────────────────────
// Without these, a single unhandled promise rejection or uncaught exception
// (e.g. a flaky third-party call, a bad cast, a socket error) kills the whole
// Node process. When the process dies, every in-flight request has its TCP
// connection closed before a response is sent — clients see Axios "Network
// Error" / net::ERR_CONNECTION_CLOSED. Log loudly but keep serving.
process.on("unhandledRejection", (reason: unknown) => {
  console.error("[process] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err: Error) => {
  console.error("[process] Uncaught exception:", err);
});

// ── Precomputed CORS allow-list ─────────────────────────────────────────────
// Computed once at startup instead of parsing env on every request.
const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "https://product-hunt-admin.vercel.app",
      "https://product-hunt-frontend-blush.vercel.app",
      "https://product-hunt-frontend.vercel.app",
    ];

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow all origins in development, or the allow-list in production
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
    if (isDev || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // 24 hours — browsers cache the preflight, fewer OPTIONS round-trips
};

const app: Application = express();

// Render (and most PaaS) terminate TLS at their proxy — trust one hop so
// req.ip / rate-limit see the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);
// Security: don't advertise the framework.
app.disable("x-powered-by");

// ── Security headers (helmet) ───────────────────────────────────────────────
// crossOriginResourcePolicy relaxed so the Vercel frontend can load images
// served from /uploads cross-origin.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// ── Request logging ─────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Response compression ────────────────────────────────────────────────────
// Exclude SSE streams (they must stream, not buffer) and allow opt-out.
const shouldCompress = (req: Request, res: Response) => {
  if (req.headers["x-no-compression"]) return false;
  if (res.getHeader("Content-Type") === "text/event-stream") return false;
  return compression.filter(req, res);
};
app.use(compression({ filter: shouldCompress, threshold: 1024 }));

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));

// ── Body parsing ────────────────────────────────────────────────────────────
// Uploads go through multer (multipart), so a 2MB JSON limit is plenty for
// every JSON API call and trims a potential DoS vector.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Static files from the workspace uploads directory ───────────────────────
const uploadsPath = path.resolve(process.cwd(), "uploads");
// Long browser cache for uploaded assets (they are content-addressed by name).
app.use(
  "/uploads",
  express.static(uploadsPath, {
    maxAge: "1d",
    immutable: false,
    etag: true,
  })
);
app.use(
  "/api/uploads",
  express.static(uploadsPath, {
    maxAge: "1d",
    etag: true,
  })
);

// ── Health check — lets Render / uptime monitors (UptimeRobot, cron-job.org)
// ping a cheap endpoint instead of a heavy one, and proves the process is alive.
// Deliberately NOT rate-limited and NOT compressed.
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
    cache: cacheStats(),
  });
});

// ── Rate limiting (must come after trust proxy) ─────────────────────────────
// Apply to the whole API surface.
app.use("/api", apiLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use(router);

// ── 404 handler — always answer with JSON so clients never get a hung/empty
// connection when they hit an unknown route.
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Global error middleware — Express 5 forwards errors thrown/rejected in
// route handlers here. Return a clean JSON error instead of crashing the app.
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error("[error] Unhandled error in request:", err);
  // Preserve body-parser error statuses (400 bad JSON, 413 payload too large)
  const status = (err as any).status || (err as any).statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Server error",
  });
});

// ── Server lifecycle ────────────────────────────────────────────────────────
const server = http.createServer(app);
const port: number = parseInt(process.env.PORT || "5000", 10);

// Initialise Socket.IO
initSocketIO(server);

/**
 * Wait until Mongoose is connected (or the timeout expires).
 * Prevents the classic "first request fails / works sometimes" bug where
 * traffic arrives before the DB connection is established after a deploy.
 */
function waitForDatabase(timeoutMs: number): Promise<boolean> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onConnected = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      mongoose.connection.off("connected", onConnected);
      resolve(false);
    }, timeoutMs);
    mongoose.connection.once("connected", onConnected);
  });
}

// Graceful shutdown — Render sends SIGTERM before killing the instance.
// Close the HTTP server + DB so in-flight requests finish instead of dying
// mid-response (which shows up as ERR_CONNECTION_CLOSED).
async function shutdown(signal: string): Promise<void> {
  console.log(`[process] ${signal} received — shutting down gracefully`);
  try {
    server.close(async () => {
      await mongoose.disconnect();
      console.log("[process] Shutdown complete");
      process.exit(0);
    });
    // If connections won't drain (e.g. long SSE), force-exit after 10s.
    setTimeout(() => process.exit(1), 10_000).unref();
  } catch (err) {
    console.error("[process] Error during shutdown:", err);
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Kick off non-blocking startup work (Cloudinary config, upload dirs).
initCloudinary();
createUploadDirectories()
  .then(() => console.log("Upload directories initialized"))
  .catch((error) => console.error("Error creating upload directories:", error));

// Start the DB connection and WAIT for it (capped at 15s) before listening,
// so the very first requests never hit an uninitialized connection. If the DB
// is unreachable the server still starts — /health reports db: disconnected
// and queries fail fast with a JSON error until it reconnects.
void connectDB();
const dbReady = await waitForDatabase(15_000);
if (!dbReady) {
  console.error(
    "[startup] MongoDB not connected within 15s — starting anyway. Requests will fail until the DB connects."
  );
}

// Server listen — gracefully handle EADDRINUSE
server.listen(port, () => {
  console.log(`Product Hunt backend listening at http://localhost:${port}`);
});

// Keep-alive tweaks for Render's proxy. Node's defaults (5s keep-alive,
// 60s headers) are shorter than Render's proxy idle timeout, which can make
// the proxy drop an idle-but-open connection mid-request (ERR_CONNECTION_CLOSED).
server.keepAliveTimeout = 120_000; // 120s
server.headersTimeout = 121_000;   // must be > keepAliveTimeout

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Please stop the existing process or use a different port.`
    );
    process.exit(1);
  } else {
    console.error("Server error:", err.message);
    process.exit(1);
  }
});
