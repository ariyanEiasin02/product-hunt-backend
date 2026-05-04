import { Router } from "express";
import {
  createCommentController,
  createReplyController,
  getProductCommentsController,
  getCommentRepliesController,
  updateCommentController,
  deleteCommentController,
  getUserCommentsController,
  upvoteCommentController,
  getAllCommentsController,
  commentStatusController,
  adminEditCommentController,
} from "../../controllers/commentController.js";
import { verifyToken, isAdmin } from "../../middleware/authMiddleware.js";

const router = Router();

// Get all comments across all products
router.get("/all/comments", getAllCommentsController);

// Create a comment on a product (requires authentication)
router.post("/products/:productId/comments", verifyToken, createCommentController);

// Get all comments for a product
router.get("/products/:productId/comments", getProductCommentsController);

// Create a reply to a comment (requires authentication)
router.post("/comments/:commentId/replies", verifyToken, createReplyController);

// Get replies to a specific comment
router.get("/comments/:commentId/replies", getCommentRepliesController);

// Update a comment (requires authentication)
router.put("/comments/:commentId", verifyToken, updateCommentController);

// Delete a comment (requires authentication)
router.delete("/comments/:commentId", verifyToken, deleteCommentController);

// Upvote/downvote a comment (requires authentication)
router.post("/comments/:commentId/upvote", verifyToken, upvoteCommentController);

// Get user's comments
router.get("/users/:userId/comments", getUserCommentsController);

// Admin: update comment status
router.put("/comments/:commentId/status", verifyToken, isAdmin, commentStatusController);

// Admin: edit comment
router.put("/comments/:commentId/admin-edit", verifyToken, isAdmin, adminEditCommentController);

export default router;
