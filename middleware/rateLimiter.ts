import { rateLimit } from "express-rate-limit";

/**
 * Rate limiting protects the API from abuse, scrapers and accidental
 * runaway loops — which on Render Free also translates directly into
 * CPU/memory spikes that can crash the instance.
 *
 * Must be enabled AFTER `app.set("trust proxy", 1)` (see index.ts), so the
 * real client IP from X-Forwarded-For is used instead of Render's proxy IP.
 *
 * Limits are generous (configurable via env) so legit frontends are never
 * blocked. Tune down only if you observe abuse.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** General API limit — applies to everything except auth + uploads. */
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_API_MAX || 600), // ~40 req/min
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

/** Stricter limit for login/register to slow credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX || 50), // ~3.3 req/min
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts, please try again later.",
  },
});

/**
 * Optional strict limiter for file-upload endpoints. Uploads are expensive
 * (sharp conversion + Cloudinary), so an attacker can burn your CPU/memory
 * and Cloudinary quota. Keep it generous for legit users.
 */
export const uploadLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 100),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many uploads, please try again later.",
  },
});

export default { apiLimiter, authLimiter, uploadLimiter };
