import { Router } from "express";
import authRouter from "./authentication.js";
import categoryRouter from "./categories.js";
import productRouter from "./product.js";
import commentsRouter from "./comments.js";
import reviewsRouter from "./reviews.js";
import uploadRouter from "./upload.js";
import searchRouter from "./search.js";
import profileRouter from "./profile.js";
import leaderboardRouter from "./leaderboard.js";
import storiesRouter from "./stories.js";
import dashboardRouter from "./dashboard.js";
import visitStreakRouter from "./visitStreakRoutes.js";
import notificationRouter from "./notification.js";
import pagesRouter from "./pages.js";
import faqsRouter from "./faqs.js";
import productGuidesRouter from "./productGuides.js";
import { getHomePageProductsController } from "../../controllers/productController.js";
import { optionalAuth } from "../../middleware/authMiddleware.js";

const router = Router();

// Specific routes first
router.use("/authentication", authRouter);
router.use("/categories", categoryRouter);
router.use("/products", productRouter);
router.use("/profile", profileRouter);
router.use("/search", searchRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/stories", storiesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/visit-streaks", visitStreakRouter);
router.get("/home", optionalAuth, getHomePageProductsController);

// notification route
router.use("/notifications", notificationRouter);
// pages route
router.use("/pages", pagesRouter);
// faqs route
router.use("/faqs", faqsRouter);
// product guides route
router.use("/product-guides", productGuidesRouter);

// Generic routes last (they use "/" base path)
router.use("/", uploadRouter);
router.use("/", commentsRouter);
router.use("/", reviewsRouter);

export default router;
