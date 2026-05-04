import { Router } from "express";
import {
  getUsernameProfileController,
  getUserUpvotesController,
  getUserProfileReviewsController,
  getUserCollectionsController,
  getUserProductsController,
} from "../../controllers/profileController.js";
import { verifyToken, optionalAuth } from "../../middleware/authMiddleware.js";

const profileRouter = Router();

// Get user profile by username
profileRouter.get("/:username", optionalAuth, getUsernameProfileController);

// Get user's upvoted products
profileRouter.get("/:username/upvotes", optionalAuth, getUserUpvotesController);

// Get user's reviews
profileRouter.get("/:username/reviews", optionalAuth, getUserProfileReviewsController);

// Get user's saved/collections (own profile only)
profileRouter.get("/:username/collections", verifyToken, getUserCollectionsController);

// Get user's own products (as maker)
profileRouter.get("/:username/products", optionalAuth, getUserProductsController);

export default profileRouter;
