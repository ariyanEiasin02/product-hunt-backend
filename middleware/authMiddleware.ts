import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/userSchema.js";

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * ── User-lookup cache ───────────────────────────────────────────────────────
 * Every authenticated request used to hit MongoDB (User.findById) just to read
 * { email, role }. That's a DB round-trip (~5-20ms on Atlas) added to EVERY
 * request. We cache the identity for 60s per user: role changes (e.g. an admin
 * promotion) reflect within a minute, which is perfectly acceptable for a
 * Product Hunt style site.
 */
const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map<
  string,
  { email: string; role: string; expiresAt: number }
>();

async function fetchUserIdentity(
  id: string
): Promise<{ email: string; role: string } | null> {
  const cached = userCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return { email: cached.email, role: cached.role };
  }

  const user = await User.findById(id).select("email role").lean().exec();
  if (!user) return null;

  userCache.set(id, {
    email: user.email,
    role: user.role,
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
  });

  // Cap the cache so a flood of tokens can't grow it unboundedly.
  if (userCache.size > 20_000) {
    const now = Date.now();
    for (const [key, entry] of userCache) {
      if (entry.expiresAt <= now) userCache.delete(key);
    }
  }

  return { email: user.email, role: user.role };
}

// ── Shared token verification (sync, no DB) ─────────────────────────────────
function verifyTokenSync(
  token: string
): { email: string; id: string } | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "secret-key") as {
      email: string;
      id: string;
    };
  } catch {
    return null;
  }
}

/** Make sure JWT_SECRET is actually set in production. */
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error(
    "[auth] WARNING: JWT_SECRET is not set in production! Tokens are signed with the default fallback. Set JWT_SECRET in Render env vars."
  );
}

/* Middleware to verify JWT token */
export async function verifyToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
    return;
  }

  const decoded = verifyTokenSync(token);
  if (!decoded) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
    return;
  }

  try {
    const identity = await fetchUserIdentity(decoded.id);
    if (!identity) {
      res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
      return;
    }

    req.user = { id: decoded.id, email: identity.email, role: identity.role };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}

// Middleware to check if user is admin
export function isAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
    return;
  }
  next();
}

// Middleware to allow admin or the user themself (owner) to proceed
export function isAdminOrSelf(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return;
  }

  const targetUserId = req.params.id;
  if (req.user.role === "admin" || req.user.id === targetUserId) {
    next();
    return;
  }

  res.status(403).json({ success: false, message: "Access denied." });
}

// Optional middleware to verify JWT token (doesn't fail if no token)
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    next();
    return;
  }

  const decoded = verifyTokenSync(token);
  if (decoded) {
    try {
      const identity = await fetchUserIdentity(decoded.id);
      if (identity) {
        req.user = {
          id: decoded.id,
          email: identity.email,
          role: identity.role,
        };
      }
    } catch {
      // Token invalid or expired, continue without user
    }
  }

  next();
}

export default { verifyToken, isAdmin, optionalAuth, isAdminOrSelf };
