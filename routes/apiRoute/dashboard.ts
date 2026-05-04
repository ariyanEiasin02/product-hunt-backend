import { Router } from "express";
import { getDashboardOverview } from "../../controllers/dashboardController.js";
import { verifyToken, isAdmin } from "../../middleware/authMiddleware.js";

const dashboardRouter = Router();

// GET /api/dashboard/overview - Admin only
dashboardRouter.get("/overview", verifyToken, isAdmin, getDashboardOverview);

export default dashboardRouter;
