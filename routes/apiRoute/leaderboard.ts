import { Router } from "express";
import { getLeaderboardController } from "../../controllers/leaderboardController.js";
import { optionalAuth } from "../../middleware/authMiddleware.js";

const leaderboardRouter = Router();

// GET /api/leaderboard?period=daily&year=2026&month=2&day=5&tab=featured&page=1&limit=20
leaderboardRouter.get("/", optionalAuth, getLeaderboardController);

export default leaderboardRouter;
