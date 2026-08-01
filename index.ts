import express, { Application, NextFunction, Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import router from "./routes/index.js";
import { createUploadDirectories } from "./utils/fileUploadHelper.js";
import { initSocketIO } from "./config/socket.js";
import { initCloudinary } from "./config/cloudinary.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

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

// Initialize Cloudinary with credentials from .env
initCloudinary();

// Connect to MongoDB
connectDB();

// Create upload directories if they don't exist
createUploadDirectories().then(() => {
  console.log("Upload directories initialized");
}).catch((error) => {
  console.error("Error creating upload directories:", error);
});

const app: Application = express();
const server = http.createServer(app);
const port: number = parseInt(process.env.PORT || "5000");

// Initialise Socket.IO
initSocketIO(server);

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development, or specific origins in production
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'https://product-hunt-admin.vercel.app',
          'https://product-hunt-frontend-blush.vercel.app',
          'https://product-hunt-frontend.vercel.app',
        ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from the workspace uploads directory.
// Use process.cwd() so this works both in TS dev mode and compiled dist mode.
const uploadsPath = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));
app.use("/api/uploads", express.static(uploadsPath));

// Health check — lets Render / uptime monitors (UptimeRobot etc.) ping a
// cheap endpoint instead of a heavy one, and proves the process is alive.
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Use routes
app.use(router);

// 404 handler — always answer with JSON so clients never get a hung/empty
// connection when they hit an unknown route.
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error middleware — Express 5 forwards errors thrown/rejected in
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


// Server listen — gracefully handle EADDRINUSE
server.listen(port, () => {
  console.log(
    `Product Hunt backend listening at http://localhost:${port}`
  );
});

// Keep-alive tweaks for Render's proxy. Node's defaults (5s keep-alive,
// 60s headers) are shorter than Render's proxy idle timeout, which can make
// the proxy drop an idle-but-open connection mid-request (ERR_CONNECTION_CLOSED).
server.keepAliveTimeout = 120_000; // 120s
server.headersTimeout = 121_000;   // must be > keepAliveTimeout

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Please stop the existing process or use a different port.`);
    process.exit(1);
  } else {
    console.error("Server error:", err.message);
    process.exit(1);
  }
});
