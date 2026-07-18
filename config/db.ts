import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI || "";

    // ── Production-optimised connection pool ──────────────────────────────
    // minPoolSize:  Keeps 5 connections alive after idle, avoiding TLS
    //               handshake overhead on every burst of requests.
    // maxPoolSize:  Caps concurrent connections to MongoDB Atlas to prevent
    //               overwhelming the free-tier M0 cluster.
    // serverSelectionTimeoutMS:  Fail fast (5s) — don't let a hung DNS/
    //               network request tie up a serverless/Render process.
    // socketTimeoutMS:  Close sockets that stall for 45s (e.g. during a
    //               slow aggregation).    // heartbeartFrequencyMS: (default 10s) Keep-alive pings to detect
    // replica-set changes quickly.
    await mongoose.connect(mongoURI, {
      minPoolSize: 5,
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`Connected to Database: ${mongoose.connection.name}`);

    // Log pool stats when a connection is created / destroyed (useful for
    // monitoring in production)
    mongoose.connection.on("connected", () => {
      console.log("[MongoDB] Connection established");
    });
    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Runtime error:", err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected — will auto-reconnect");
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;