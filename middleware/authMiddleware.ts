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

/* Middleware to verify JWT token */
export async function verifyToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret-key"
    ) as { email: string; id: string };

    // Fetch user from database
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
      return;
    }

    // Attach user to request object
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

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
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      // No token provided, continue without user
      next();
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret-key"
    ) as { email: string; id: string };

    // Fetch user from database
    const user = await User.findById(decoded.id).select("-password");
    if (user) {
      // Attach user to request object
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      };
    }
  } catch (error) {
    // Token invalid or expired, continue without user
  }
  
  next();
}

export default { verifyToken, isAdmin, optionalAuth, isAdminOrSelf };