import express, { Application} from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
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
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000','product-hunt-admin.vercel.app','https://product-hunt-frontend-blush.vercel.app/','https://product-hunt-frontend.vercel.app/'];
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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

// Use routes
app.use(router);


// Server listen — gracefully handle EADDRINUSE
server.listen(port, () => {
  console.log(
    `Product Hunt backend listening at http://localhost:${port}`
  );
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Please stop the existing process or use a different port.`);
    process.exit(1);
  } else {
    console.error("Server error:", err.message);
    process.exit(1);
  }
});
