import { Router } from "express";
import {
  recordVisitController,
  getMyStreakController,
  getStreakLeaderboardController,
  followUserController,
  unfollowUserController,
  getAdminStreakStatsController,
  getAdminAllStreaksController,
} from "../../controllers/visitStreakController.js";
import { verifyToken, optionalAuth, isAdmin } from "../../middleware/authMiddleware.js";

const router = Router();

/**
 * Visit Streak Routes
 * Base path: /api/visit-streaks
 */

// Public routes (but auth-aware for following status)
router.get("/leaderboard", optionalAuth, getStreakLeaderboardController);

// Protected routes - require authentication
router.post("/record", verifyToken, recordVisitController);
router.get("/me", verifyToken, getMyStreakController);

// Follow/Unfollow routes
router.post("/follow/:userId", verifyToken, followUserController);
router.delete("/follow/:userId", verifyToken, unfollowUserController);

// Admin routes
router.get("/admin/stats", verifyToken, isAdmin, getAdminStreakStatsController);
router.get("/admin/all", verifyToken, isAdmin, getAdminAllStreaksController);

export default router;
