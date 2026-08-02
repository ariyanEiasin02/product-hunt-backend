import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGO_URI || "";

  // Fail fast on queries while the DB is unreachable instead of buffering
  // them indefinitely. Buffered ops hang the request forever, which makes
  // the client's TCP connection idle until the proxy/browser gives up →
  // Axios "Network Error" / net::ERR_CONNECTION_CLOSED.
  mongoose.set("bufferCommands", false);

  if (!mongoURI) {
    console.error(
      "[MongoDB] MONGO_URI is not set — API will return 500s until it is configured in Render env vars."
    );
    return;
  }

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      // ── Production-optimised connection pool ──────────────────────────────
      // minPoolSize:        Keeps a few connections alive after idle, avoiding
      //                     the TLS handshake cost on every burst of requests.
      // maxPoolSize:        Caps concurrent connections to MongoDB Atlas so the
      //                     free-tier M0 cluster is never overwhelmed.
      // serverSelectionTimeoutMS:  Fail fast (5s) — don't let a hung DNS or
      //                     network request tie up the Render process.
      // socketTimeoutMS:    Close sockets that stall for 45s (e.g. during a
      //                     slow aggregation).
      // connectTimeoutMS:   Bound the initial TCP/TLS connect (defaults to 30s
      //                     in older drivers, 10s is plenty).
      // maxIdleTimeMS:      Free idle sockets after 60s so an idle instance
      //                     doesn't hold connections forever.
      // heartbeatFrequencyMS: Check server health every 10s (default 10s) —
      //                     keeps the driver's view of the topology fresh.
      await mongoose.connect(mongoURI, {
        minPoolSize: 2,
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        maxIdleTimeMS: 60000,
        heartbeatFrequencyMS: 10000,
        // Don't rebuild indexes on every boot in production — that is wasted
        // CPU at cold start. Schema indexes are still created on first
        // connection in dev; run `npm run sync-indexes` once in production.
        autoIndex: process.env.NODE_ENV !== "production",
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
      return;
    } catch (error) {
      // A malformed URI (e.g. MongoParseError) will never recover — log once
      // and stop retrying so the logs aren't spammed forever.
      if (error instanceof Error && error.name === "MongoParseError") {
        console.error(
          "[MongoDB] MONGO_URI is invalid — fix it in Render env vars:",
          error.message
        );
        return;
      }
      // Transient failure (network, Atlas hiccup): never process.exit() —
      // that kills the whole API and closes every in-flight connection.
      // Instead log and retry with backoff; the server stays up and requests
      // fail fast with a JSON 500 until MongoDB is reachable again.
      const delay = Math.min(1000 * attempt, 10000);
      console.error(
        `MongoDB connection error (attempt ${attempt}), retrying in ${delay}ms:`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export default connectDB;