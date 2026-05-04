import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../models/reviewSchema.js";
import Product from "../models/productSchema.js";
import { createNotification } from "./notificationController.js";

/**
 * Helper function to recalculate and update product rating statistics
 */
async function updateProductRatingStats(productId: string): Promise<void> {
  const stats = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const averageRating = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
  const totalReviews = stats.length > 0 ? stats[0].totalReviews : 0;

  await Product.findByIdAndUpdate(productId, {
    averageRating,
    totalReviews,
  });
}

/**
 * Helper: Resolve product by ID or slug
 */
async function resolveProduct(identifier: string) {
  // Try ObjectId first, then slug
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return Product.findById(identifier);
  }
  return Product.findOne({ slug: identifier });
}

/**
 * Create a new review for a product
 * POST /api/products/:productId/reviews
 */
export async function createReviewController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { productId } = req.params;
    const { rating, title, content, pros, cons, isVerifiedPurchase } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Validate required fields
    if (!rating || !title || !content) {
      res.status(400).json({
        success: false,
        message: "Rating, title, and content are required",
      });
      return;
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
      return;
    }

    // Check if product exists (supports slug or ObjectId)
    const product = await resolveProduct(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    const productObjectId = product._id;

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      product: productObjectId,
      user: userId,
    });

    if (existingReview) {
      res.status(409).json({
        success: false,
        message: "You have already reviewed this product. Please edit your existing review.",
      });
      return;
    }

    // Create review
    const review = await Review.create({
      product: productObjectId,
      user: userId,
      rating,
      title: title.trim(),
      content: content.trim(),
      pros: pros || [],
      cons: cons || [],
      isVerifiedPurchase: isVerifiedPurchase || false,
    });

    // Update product rating statistics
    await updateProductRatingStats(productObjectId.toString());

    // Populate user details (include username and profileImage)
    await review.populate("user", "fullname email username profileImage");

    // ── Notification: new review → notify product makers ──────────────────
    if (product.makers && product.makers.length > 0) {
      const actor = await (await import("../models/userSchema.js")).default.findById(userId).select("fullname username");
      const actorName = actor?.fullname || "Someone";
      for (const makerId of product.makers) {
        await createNotification({
          recipient: makerId.toString(),
          actor: userId,
          type: "review",
          message: `${actorName} reviewed ${product.name} (${rating}★)`,
          entityId: product._id.toString(),
          entityType: "product",
          link: `/products/${product.slug}`,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: review,
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
 * Get all reviews for a product with statistics
 * GET /api/products/:productId/reviews
 * Supports both ObjectId and slug as :productId
 * Query params: ?rating=5&sortBy=helpful&page=1&limit=20
 */
export async function getProductReviewsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { productId } = req.params;
    const { 
      limit = 20, 
      page = 1, 
      sortBy = "helpful", // helpful, recent, rating_high, rating_low
      rating 
    } = req.query;

    // Resolve by slug or ObjectId
    const product = await resolveProduct(productId);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    const productObjectId = product._id;
    const filter: any = { product: productObjectId, status: "approved" };
    
    // Filter by rating if specified
    if (rating) {
      filter.rating = Number(rating);
    }

    // Determine sort order
    let sortOptions: any = {};
    switch (sortBy) {
      case "recent":
        sortOptions = { createdAt: -1 };
        break;
      case "rating_high":
        sortOptions = { rating: -1, createdAt: -1 };
        break;
      case "rating_low":
        sortOptions = { rating: 1, createdAt: -1 };
        break;
      case "helpful":
      default:
        sortOptions = { helpfulCount: -1, createdAt: -1 };
        break;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find(filter)
      .populate("user", "fullname email username profileImage")
      .sort(sortOptions)
      .limit(Number(limit))
      .skip(skip);

    const total = await Review.countDocuments(filter);

    // Calculate rating statistics (unfiltered - always show full distribution)
    const ratingStats = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productObjectId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          rating5: {
            $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] },
          },
          rating4: {
            $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] },
          },
          rating3: {
            $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] },
          },
          rating2: {
            $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] },
          },
          rating1: {
            $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] },
          },
          verifiedPurchases: {
            $sum: { $cond: ["$isVerifiedPurchase", 1, 0] },
          },
          totalHelpful: {
            $sum: "$helpfulCount",
          },
        },
      },
    ]);

    const totalReviews = ratingStats.length > 0 ? ratingStats[0].totalReviews : 0;

    const statistics = ratingStats.length > 0
      ? {
          averageRating: Math.round(ratingStats[0].averageRating * 10) / 10,
          totalReviews: ratingStats[0].totalReviews,
          verifiedPurchases: ratingStats[0].verifiedPurchases,
          totalHelpful: ratingStats[0].totalHelpful,
          ratingDistribution: [
            { stars: 5, count: ratingStats[0].rating5, percentage: totalReviews > 0 ? Math.round((ratingStats[0].rating5 / totalReviews) * 100) : 0 },
            { stars: 4, count: ratingStats[0].rating4, percentage: totalReviews > 0 ? Math.round((ratingStats[0].rating4 / totalReviews) * 100) : 0 },
            { stars: 3, count: ratingStats[0].rating3, percentage: totalReviews > 0 ? Math.round((ratingStats[0].rating3 / totalReviews) * 100) : 0 },
            { stars: 2, count: ratingStats[0].rating2, percentage: totalReviews > 0 ? Math.round((ratingStats[0].rating2 / totalReviews) * 100) : 0 },
            { stars: 1, count: ratingStats[0].rating1, percentage: totalReviews > 0 ? Math.round((ratingStats[0].rating1 / totalReviews) * 100) : 0 },
          ],
        }
      : {
          averageRating: 0,
          totalReviews: 0,
          verifiedPurchases: 0,
          totalHelpful: 0,
          ratingDistribution: [
            { stars: 5, count: 0, percentage: 0 },
            { stars: 4, count: 0, percentage: 0 },
            { stars: 3, count: 0, percentage: 0 },
            { stars: 2, count: 0, percentage: 0 },
            { stars: 1, count: 0, percentage: 0 },
          ],
        };

    res.status(200).json({
      success: true,
      message: "Reviews retrieved successfully",
      data: {
        product: {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          thumbnail: product.thumbnail,
          tagline: product.tagline,
        },
        reviews,
        statistics,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
          hasNextPage: skip + reviews.length < total,
          hasPrevPage: Number(page) > 1,
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
 * Update a review
 * PUT /api/reviews/:reviewId
 */
export async function updateReviewController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { reviewId } = req.params;
    const { rating, title, content, pros, cons } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found",
      });
      return;
    }

    // Check if user owns the review
    if (review.user.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only edit your own reviews",
      });
      return;
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
      return;
    }

    // Update review fields
    const ratingChanged = rating && rating !== review.rating;
    
    if (rating) review.rating = rating;
    if (title) review.title = title.trim();
    if (content) review.content = content.trim();
    if (pros) review.pros = pros;
    if (cons) review.cons = cons;
    
    review.isEdited = true;
    review.editedAt = new Date();
    
    await review.save();

    // Update product rating statistics if rating changed
    if (ratingChanged) {
      await updateProductRatingStats(review.product.toString());
    }

    await review.populate("user", "fullname email username profileImage");

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: review,
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
 * Delete a review
 * DELETE /api/reviews/:reviewId
 */
export async function deleteReviewController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { reviewId } = req.params;
    const user = (req as any).user;

    if (!user?.id) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found",
      });
      return;
    }

    const isOwner = review.user.toString() === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        success: false,
        message: "You are not allowed to delete this review",
      });
      return;
    }

    const productId = review.product.toString();

    await Review.findByIdAndDelete(reviewId);
    await updateProductRatingStats(productId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Server error";

    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}


/**
 * Get user's reviews
 * GET /api/users/:userId/reviews
 */
export async function getUserReviewsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find({ user: userId })
      .populate("user", "fullname email")
      .populate("product", "name slug thumbnail")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Review.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      message: "User reviews retrieved successfully",
      data: {
        reviews,
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
 * Toggle helpful on a review
 * POST /api/reviews/:reviewId/helpful
 */
export async function markReviewHelpfulController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found",
      });
      return;
    }

    // Check if user has already marked as helpful
    const hasMarkedHelpful = review.helpfulBy.some(
      (helpfulId: mongoose.Types.ObjectId) => helpfulId.toString() === userId
    );

    let updatedReview;
    let message: string;

    if (hasMarkedHelpful) {
      // Remove helpful mark
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $pull: { helpfulBy: userId },
          $inc: { helpfulCount: -1 },
        },
        { new: true }
      )
        .populate("user", "fullname email")
        .populate("product", "name slug thumbnail");
      message = "Helpful mark removed successfully";
    } else {
      // Add helpful mark
      updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        {
          $addToSet: { helpfulBy: userId },
          $inc: { helpfulCount: 1 },
        },
        { new: true }
      )
        .populate("user", "fullname email")
        .populate("product", "name slug thumbnail");
      message = "Review marked as helpful successfully";

      // Create helpful/upvote notification for review author
      const reviewOwnerId = review.user?.toString();
      if (reviewOwnerId) {
        const productSlug = (updatedReview?.product as any)?.slug || "";
        await createNotification({
          recipient: reviewOwnerId,
          actor: userId,
          type: "upvote_review",
          message: "Someone found your review helpful",
          entityId: reviewId,
          entityType: "review",
          link: productSlug ? `/products/${productSlug}` : "",
        });
      }
    }

    res.status(200).json({
      success: true,
      message,
      data: {
        review: updatedReview,
        isHelpful: !hasMarkedHelpful,
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
 * Get all reviews with pagination and statistics in one API call
 * GET /api/all/reviews?page=1&limit=20&rating=5&sort=createdAt&order=desc
 */
export async function getAllReviewsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { 
      limit = 20, 
      page = 1, 
      rating,
      sort = 'createdAt',
      order = 'desc',
      search
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build filter object
    const filter: any = {};
    
    // Filter by rating if specified
    if (rating) {
      filter.rating = Number(rating);
    }

    // Search in title and content if search query provided
    if (search && typeof search === 'string') {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj: any = {};
    sortObj[sort as string] = sortOrder;

    // Get paginated reviews
    const reviews = await Review.find(filter)
      .populate("user", "fullname email")
      .populate("product", "name slug thumbnail")
      .sort(sortObj)
      .limit(Number(limit))
      .skip(skip);

    // Get total count for pagination
    const total = await Review.countDocuments(filter);

    // Calculate statistics for all reviews (not filtered)
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          rating5: {
            $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] },
          },
          rating4: {
            $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] },
          },
          rating3: {
            $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] },
          },
          rating2: {
            $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] },
          },
          rating1: {
            $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] },
          },
          verifiedPurchases: {
            $sum: { $cond: ["$isVerifiedPurchase", 1, 0] },
          },
          totalHelpful: {
            $sum: "$helpfulCount"
          }
        },
      },
    ]);

    const statistics = stats.length > 0
      ? {
          averageRating: Math.round(stats[0].averageRating * 10) / 10,
          totalReviews: stats[0].totalReviews,
          verifiedPurchases: stats[0].verifiedPurchases,
          totalHelpful: stats[0].totalHelpful,
          ratingDistribution: {
            5: {
              count: stats[0].rating5,
              percentage: stats[0].totalReviews > 0 
                ? Math.round((stats[0].rating5 / stats[0].totalReviews) * 100) 
                : 0,
            },
            4: {
              count: stats[0].rating4,
              percentage: stats[0].totalReviews > 0 
                ? Math.round((stats[0].rating4 / stats[0].totalReviews) * 100) 
                : 0,
            },
            3: {
              count: stats[0].rating3,
              percentage: stats[0].totalReviews > 0 
                ? Math.round((stats[0].rating3 / stats[0].totalReviews) * 100) 
                : 0,
            },
            2: {
              count: stats[0].rating2,
              percentage: stats[0].totalReviews > 0 
                ? Math.round((stats[0].rating2 / stats[0].totalReviews) * 100) 
                : 0,
            },
            1: {
              count: stats[0].rating1,
              percentage: stats[0].totalReviews > 0 
                ? Math.round((stats[0].rating1 / stats[0].totalReviews) * 100) 
                : 0,
            },
          },
        }
      : {
          averageRating: 0,
          totalReviews: 0,
          verifiedPurchases: 0,
          totalHelpful: 0,
          ratingDistribution: {
            5: { count: 0, percentage: 0 },
            4: { count: 0, percentage: 0 },
            3: { count: 0, percentage: 0 },
            2: { count: 0, percentage: 0 },
            1: { count: 0, percentage: 0 },
          },
        };

    res.status(200).json({
      success: true,
      message: "All reviews retrieved successfully",
      data: {
        reviews,
        statistics,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
          hasNextPage: skip + reviews.length < total,
          hasPrevPage: Number(page) > 1,
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


export async function reviewStatusController(
  req: Request,
  res: Response): Promise<void> {
  try {
    const { reviewId } = req.params;
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

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ success: false, message: "Review not found" });
      return;
    }

    review.status = status;
    await review.save();

    const populatedReview = await Review.findById(reviewId)
      .populate("user", "fullname email")
      .populate("product", "name slug thumbnail");

    res.status(200).json({ success: true, message: "Review status updated", data: populatedReview });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

/**
 * Admin edit a review
 * PUT /api/reviews/:reviewId/admin-edit
 */
export async function adminEditReviewController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { reviewId } = req.params;
    const { rating, title, content, pros, cons, status } = req.body;
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({ success: false, message: "Admin access required" });
      return;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ success: false, message: "Review not found" });
      return;
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
        return;
      }
      review.rating = rating;
    }
    if (title !== undefined) review.title = title.trim();
    if (content !== undefined) review.content = content.trim();
    if (pros !== undefined) review.pros = pros;
    if (cons !== undefined) review.cons = cons;
    if (status !== undefined) {
      const validStatuses = ["pending", "approved", "rejected"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, message: "Invalid status" });
        return;
      }
      review.status = status;
    }

    review.isEdited = true;
    review.editedAt = new Date();
    await review.save();

    if (rating !== undefined) {
      await updateProductRatingStats(review.product.toString());
    }

    const populatedReview = await Review.findById(reviewId)
      .populate("user", "fullname email")
      .populate("product", "name slug thumbnail");

    res.status(200).json({
      success: true,
      message: "Review updated by admin",
      data: populatedReview,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

export default {
  createReviewController,
  updateReviewController,
  deleteReviewController,
  getUserReviewsController,
  markReviewHelpfulController,
  getProductReviewsController,
  getAllReviewsController,
  reviewStatusController,
  adminEditReviewController
};
