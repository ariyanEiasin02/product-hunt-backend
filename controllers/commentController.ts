import { Request, Response } from "express";
import mongoose from "mongoose";
import Comment from "../models/commentSchema.js";
import Product from "../models/productSchema.js";
import { createNotification, upsertNotification, removeNotificationIfExists } from "./notificationController.js";

/**
 * Create a new comment on a product
 * POST /api/products/:productId/comments
 */
export async function createCommentController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { productId } = req.params;
    const { content, parentComment } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({
        success: false,
        message: "Comment cannot exceed 2000 characters",
      });
      return;
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    // If it's a reply, check if parent comment exists and increment reply count
    if (parentComment) {
      const parentCommentDoc = await Comment.findById(parentComment);
      if (!parentCommentDoc) {
        res.status(404).json({
          success: false,
          message: "Parent comment not found",
        });
        return;
      }

      // Validate that parent comment belongs to the same product
      if (parentCommentDoc.product.toString() !== productId) {
        res.status(400).json({
          success: false,
          message: "Parent comment does not belong to this product",
        });
        return;
      }

      // Check if parent comment is deleted
      if (parentCommentDoc.isDeleted) {
        res.status(410).json({
          success: false,
          message: "Cannot reply to a deleted comment",
        });
        return;
      }
      
      // Increment parent comment's reply count
      await Comment.findByIdAndUpdate(parentComment, {
        $inc: { replyCount: 1 },
      });
    }

    // Create comment
    const comment = await Comment.create({
      product: productId,
      user: userId,
      content: content.trim(),
      parentComment: parentComment || null,
    });

    // Only increment product comments count for TOP-LEVEL comments (not replies)
    // Replies are tracked via replyCount on parent comment
    if (!parentComment) {
      await Product.findByIdAndUpdate(productId, {
        $inc: { commentsCount: 1 },
      });
    }

    // Populate user details - refetch the comment with populated fields
    const populatedComment = await Comment.findById(comment._id)
      .populate("user", "fullname email username profileImage")
      .populate("product", "name slug");

    // ── Notification: new comment on product → notify makers ──────────────
    if (!parentComment && product.makers && product.makers.length > 0) {
      const actor = await (await import("../models/userSchema.js")).default.findById(userId).select("fullname username");
      const actorName = actor?.fullname || "Someone";
      for (const makerId of product.makers) {
        await createNotification({
          recipient: makerId.toString(),
          actor: userId,
          type: "comment",
          message: `${actorName} commented on ${product.name}`,
          entityId: product._id.toString(),
          entityType: "product",
          link: `/products/${product.slug}`,
        });
      }
    }

    // ── Notification: reply → notify parent comment author ────────────────
    if (parentComment) {
      const parentDoc = await Comment.findById(parentComment);
      if (parentDoc) {
        const actor = await (await import("../models/userSchema.js")).default.findById(userId).select("fullname username");
        const actorName = actor?.fullname || "Someone";
        await createNotification({
          recipient: parentDoc.user.toString(),
          actor: userId,
          type: "reply",
          message: `${actorName} replied to your comment on ${product.name}`,
          entityId: parentDoc._id.toString(),
          entityType: "comment",
          link: `/products/${product.slug}`,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: populatedComment,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Get all comments across all products
 * GET /api/all/comments
 */
export async function getAllCommentsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { limit = 50, page = 1, parentOnly } = req.query;

    const filter: any = { isDeleted: false };
    
    // If parentOnly is true, only get top-level comments (not replies)
    if (parentOnly === "true") {
      filter.parentComment = null;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const comments = await Comment.find(filter)
      .populate("user", "fullname email username profileImage")
      .populate("product", "name slug thumbnail")
      .populate({
        path: "parentComment",
        select: "content user isDeleted",
        populate: {
          path: "user",
          select: "fullname",
        },
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Comment.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "All comments retrieved successfully",
      data: {
        comments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}
export async function getProductCommentsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { productId } = req.params;
    const { limit = 50, page = 1, parentOnly } = req.query;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    const filter: any = { product: productId, isDeleted: false, status: "approved" };
    
    // If parentOnly is true, only get top-level comments (not replies)
    if (parentOnly === "true") {
      filter.parentComment = null;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const comments = await Comment.find(filter)
      .populate("user", "fullname email username profileImage")
      .populate({
        path: "parentComment",
        select: "content user isDeleted",
        populate: {
          path: "user",
          select: "fullname",
        },
      })
      .sort({ isPinned: -1, upvotes: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Comment.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Comments retrieved successfully",
      data: {
        comments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Get replies to a specific comment
 * GET /api/comments/:commentId/replies
 */
export async function getCommentRepliesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    // Check if parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      res.status(404).json({
        success: false,
        message: "Comment not found",
      });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Get replies, excluding deleted ones
    const replies = await Comment.find({ 
      parentComment: commentId, 
      isDeleted: false 
    })
      .populate("user", "fullname email username profileImage")
      .populate("product", "name slug")
      .sort({ createdAt: 1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Comment.countDocuments({ 
      parentComment: commentId, 
      isDeleted: false 
    });

    res.status(200).json({
      success: true,
      message: "Replies retrieved successfully",
      data: {
        replies,
        count: total,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Update a comment
 * PUT /api/comments/:commentId
 */
export async function updateCommentController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({
        success: false,
        message: "Comment cannot exceed 2000 characters",
      });
      return;
    }

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({
        success: false,
        message: "Comment not found",
      });
      return;
    }

    // Check if user owns the comment
    if (comment.user.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only edit your own comments",
      });
      return;
    }

    // Update comment
    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    // Populate user details - refetch the comment with populated fields
    const populatedComment = await Comment.findById(comment._id)
      .populate("user", "fullname email username profileImage")
      .populate("product", "name slug");

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: populatedComment,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Delete a comment and all its replies permanently from database
 * DELETE /api/comments/:commentId
 */
export async function deleteCommentController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({
        success: false,
        message: "Comment not found",
      });
      return;
    }

    // Check if comment is already deleted
    if (comment.isDeleted) {
      res.status(410).json({
        success: false,
        message: "Comment is already deleted",
      });
      return;
    }

    // Check if user owns the comment
    if (comment.user.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only delete your own comments",
      });
      return;
    }

    // Function to recursively get all reply IDs (including nested replies)
    async function getAllReplyIds(parentId: string): Promise<string[]> {
      const replies = await Comment.find({ parentComment: parentId });
      let allIds: string[] = [];
      
      for (const reply of replies) {
        allIds.push(reply._id.toString());
        // Recursively get sub-replies
        const subReplyIds = await getAllReplyIds(reply._id.toString());
        allIds = allIds.concat(subReplyIds);
      }
      
      return allIds;
    }

    // Get all reply IDs (including nested)
    const replyIds = await getAllReplyIds(commentId);
    const totalDeletedCount = replyIds.length + 1; // Including parent comment

    // Permanently delete all replies from database
    if (replyIds.length > 0) {
      await Comment.deleteMany({ _id: { $in: replyIds } });
    }

    // If this was a reply, decrement parent's reply count
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $inc: { replyCount: -1 },
      });
    } else {
      // Only decrement product comments count if deleting a TOP-LEVEL comment
      // Replies don't contribute to the product's commentsCount
      await Product.findByIdAndUpdate(comment.product, {
        $inc: { commentsCount: -1 },
      });
    }

    // Permanently delete the parent comment from database
    await Comment.findByIdAndDelete(commentId);

    res.status(200).json({
      success: true,
      message: "Comment and all replies deleted permanently",
      data: {
        deletedCount: totalDeletedCount,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Get user's comments
 * GET /api/users/:userId/comments
 */
export async function getUserCommentsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const comments = await Comment.find({ user: userId, isDeleted: false })
      .populate("user", "fullname email profileImage")
      .populate("product", "name slug thumbnail")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Comment.countDocuments({ user: userId, isDeleted: false });

    res.status(200).json({
      success: true,
      message: "User comments retrieved successfully",
      data: {
        comments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Toggle upvote on a comment
 * POST /api/comments/:commentId/upvote
 */
export async function upvoteCommentController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      res.status(404).json({
        success: false,
        message: "Comment not found",
      });
      return;
    }

    if (comment.isDeleted) {
      res.status(410).json({
        success: false,
        message: "Cannot upvote deleted comment",
      });
      return;
    }

    // Check if user has already upvoted
    const hasUpvoted = comment.upvotedBy.some(
      (upvoterId: mongoose.Types.ObjectId) => upvoterId.toString() === userId
    );

    let updatedComment;
    let message: string;

    if (hasUpvoted) {
      // Remove upvote
      updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
          $pull: { upvotedBy: userId },
          $inc: { upvotes: -1 },
        },
        { new: true }
      )
        .populate("user", "fullname email username profileImage")
        .populate("product", "name slug");
      message = "Upvote removed successfully";

      // Remove the upvote notification when toggled off
      const commentOwnerId = comment.user?.toString();
      if (commentOwnerId) {
        await removeNotificationIfExists({
          recipient: commentOwnerId,
          actor:     userId,
          type:      "upvote_comment",
          entityId:  commentId,
        });
      }
    } else {
      // Add upvote
      updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
          $addToSet: { upvotedBy: userId },
          $inc: { upvotes: 1 },
        },
        { new: true }
      )
        .populate("user", "fullname email username profileImage")
        .populate("product", "name slug");
      message = "Comment upvoted successfully";

      // Upsert upvote notification for comment author (no duplicates on re-upvote)
      const commentOwnerId = comment.user?.toString();
      if (commentOwnerId) {
        const productSlug = (updatedComment?.product as any)?.slug || "";
        await upsertNotification({
          recipient:  commentOwnerId,
          actor:      userId,
          type:       "upvote_comment",
          message:    "Someone upvoted your comment",
          entityId:   commentId,
          entityType: "comment",
          link:       productSlug ? `/products/${productSlug}` : "",
        });
      }
    }

    res.status(200).json({
      success: true,
      message,
      data: {
        comment: updatedComment,
        hasUpvoted: !hasUpvoted,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Create a reply to a comment
 * POST /api/comments/:commentId/replies
 */
export async function createReplyController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Reply content is required",
      });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({
        success: false,
        message: "Reply cannot exceed 2000 characters",
      });
      return;
    }

    // Check if parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
      return;
    }

    // Check if parent comment is deleted
    if (parentComment.isDeleted) {
      res.status(410).json({
        success: false,
        message: "Cannot reply to a deleted comment",
      });
      return;
    }

    // Get the product ID from parent comment
    const productId = parentComment.product.toString();

    // Create reply
    const reply = await Comment.create({
      product: productId,
      user: userId,
      content: content.trim(),
      parentComment: commentId,
    });

    // Increment parent comment's reply count
    await Comment.findByIdAndUpdate(commentId, {
      $inc: { replyCount: 1 },
    });

    // NOTE: Do NOT increment product commentsCount for replies
    // Only top-level comments count towards the product's comment total
    // Replies are tracked via replyCount on the parent comment

    // Populate reply details
    const populatedReply = await Comment.findById(reply._id)
      .populate("user", "fullname email username profileImage")
      .populate("product", "name slug")
      .populate({
        path: "parentComment",
        select: "content user",
        populate: {
          path: "user",
          select: "fullname username profileImage",
        },
      });

    // ── Notification: reply → notify parent comment author ────────────────
    const product = await Product.findById(productId).select("name slug");
    const actor = await (await import("../models/userSchema.js")).default.findById(userId).select("fullname username");
    const actorName = actor?.fullname || "Someone";
    await createNotification({
      recipient: parentComment.user.toString(),
      actor: userId,
      type: "reply",
      message: `${actorName} replied to your comment${product ? ` on ${product.name}` : ""}`,
      entityId: parentComment._id.toString(),
      entityType: "comment",
      link: product ? `/products/${product.slug}` : "",
    });

    res.status(201).json({
      success: true,
      message: "Reply created successfully",
      data: populatedReply,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

export default {
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
};

/**
 * Admin: Update comment status (pending/approved/rejected)
 * PUT /api/comments/:commentId/status
 */
export async function commentStatusController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const { status } = req.body;
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({ success: false, message: "Admin access required" });
      return;
    }

    const validStatuses = ["pending", "approved", "rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: "Status must be pending, approved, or rejected" });
      return;
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({ success: false, message: "Comment not found" });
      return;
    }

    comment.status = status;
    await comment.save();

    const populatedComment = await Comment.findById(commentId)
      .populate("user", "fullname email profileImage")
      .populate("product", "name slug thumbnail");

    res.status(200).json({
      success: true,
      message: "Comment status updated",
      data: populatedComment,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

/**
 * Admin: Edit a comment
 * PUT /api/comments/:commentId/admin-edit
 */
export async function adminEditCommentController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const { content, status, isPinned } = req.body;
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({ success: false, message: "Admin access required" });
      return;
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({ success: false, message: "Comment not found" });
      return;
    }

    if (content !== undefined) {
      if (content.trim().length === 0) {
        res.status(400).json({ success: false, message: "Comment content cannot be empty" });
        return;
      }
      if (content.length > 2000) {
        res.status(400).json({ success: false, message: "Comment cannot exceed 2000 characters" });
        return;
      }
      comment.content = content.trim();
      comment.isEdited = true;
      comment.editedAt = new Date();
    }

    if (status !== undefined) {
      const validStatuses = ["pending", "approved", "rejected"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, message: "Invalid status" });
        return;
      }
      comment.status = status;
    }

    if (isPinned !== undefined) {
      comment.isPinned = isPinned;
    }

    await comment.save();

    const populatedComment = await Comment.findById(commentId)
      .populate("user", "fullname email profileImage")
      .populate("product", "name slug thumbnail");

    res.status(200).json({
      success: true,
      message: "Comment updated by admin",
      data: populatedComment,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}
