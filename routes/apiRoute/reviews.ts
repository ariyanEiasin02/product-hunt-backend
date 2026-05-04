import express from "express";
import {
  createReviewController,
  getProductReviewsController,
  updateReviewController,
  deleteReviewController,
  getUserReviewsController,
  markReviewHelpfulController,
  getAllReviewsController,
  reviewStatusController,
  adminEditReviewController
} from "../../controllers/reviewController.js";
import { isAdmin, verifyToken } from "../../middleware/authMiddleware.js";

const router = express.Router();

// Product review routes (create and get all for a product)
router.post("/products/:productId/reviews", verifyToken, createReviewController);
router.get("/products/:productId/reviews", getProductReviewsController);
router.get("/all/reviews", getAllReviewsController);
// Individual review routes
router.put("/reviews/:reviewId", verifyToken, updateReviewController);
router.delete("/reviews/:reviewId", verifyToken, deleteReviewController);

// Mark review as helpful
router.post("/reviews/:reviewId/helpful", verifyToken, markReviewHelpfulController);

// User reviews
router.get("/users/:userId/reviews", getUserReviewsController);

// Admin: update review status
router.put("/reviews/:reviewId/status", verifyToken, isAdmin, reviewStatusController);

// Admin: edit review
router.put("/reviews/:reviewId/admin-edit", verifyToken, isAdmin, adminEditReviewController);

export default router;
