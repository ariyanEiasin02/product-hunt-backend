import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware.js";
import User from "../models/userSchema.js";
import Product from "../models/productSchema.js";
import Review from "../models/reviewSchema.js";

// ============================================
// GET USER PROFILE BY USERNAME
// ============================================
export const getUsernameProfileController = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;

    const user = await User.findOne({ username }).select("-password");
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Count user's products (approved ones)
    const productsCount = await Product.countDocuments({
      makers: user._id,
      status: "approved",
    });

    // Count upvoted products
    const upvotesCount = await Product.countDocuments({
      upvotedBy: user._id,
    });

    // Count reviews
    const reviewsCount = await Review.countDocuments({ user: user._id });

    // Count saved/collections
    const collectionsCount = user.savedProducts?.length || 0;

    const isOwnProfile = currentUserId === user._id.toString();

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId && !isOwnProfile) {
      const currentUser = await User.findById(currentUserId).select("following");
      if (currentUser) {
        isFollowing =
          currentUser.following?.some(
            (id) => id.toString() === user._id.toString()
          ) || false;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          fullname: user.fullname,
          username: user.username,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage,
          headline: user.headline,
          about: user.about,
          website: user.website,
          socialLinks: user.socialLinks,
          followers: user.followers?.length || 0,
          following: user.following?.length || 0,
          createdAt: user.createdAt,
        },
        stats: {
          productsCount,
          upvotesCount,
          reviewsCount,
          collectionsCount,
        },
        isOwnProfile,
        isFollowing,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
      error: error.message,
    });
  }
};

// ============================================
// GET USER'S UPVOTED PRODUCTS
// ============================================
export const getUserUpvotesController = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const userId = user._id;

    // Find products this user has upvoted
    const products = await Product.find({
      upvotedBy: userId,
      status: "approved",
    })
      .populate("topics", "name slug")
      .populate("makers", "fullname email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments({
      upvotedBy: userId,
      status: "approved",
    });

    // Add upvoteTrue for current user
    const productsWithUpvoteStatus = products.map((product: any) => {
      const upvoteTrue = currentUserId
        ? product.upvotedBy?.some(
            (id: any) => id.toString() === currentUserId
          )
          ? 1
          : 0
        : 0;

      const { upvotedBy, ...rest } = product;
      return { ...rest, upvoteTrue };
    });

    res.status(200).json({
      success: true,
      data: productsWithUpvoteStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching user upvotes",
      error: error.message,
    });
  }
};

// ============================================
// GET USER'S REVIEWS
// ============================================
export const getUserProfileReviewsController = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const userId = user._id;

    const reviews = await Review.find({ user: userId })
      .populate("product", "name slug tagline thumbnail upvotes commentsCount topics")
      .populate("user", "fullname email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // For each review, also populate product topics
    const reviewsPopulated = await Promise.all(
      reviews.map(async (review: any) => {
        if (review.product) {
          const product = await Product.findById(review.product._id)
            .populate("topics", "name slug")
            .select("name slug tagline thumbnail upvotes commentsCount topics")
            .lean();
          return { ...review, product };
        }
        return review;
      })
    );

    const total = await Review.countDocuments({ user: user._id });

    res.status(200).json({
      success: true,
      data: reviewsPopulated,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching user reviews",
      error: error.message,
    });
  }
};

// ============================================
// GET USER'S SAVED/COLLECTIONS PRODUCTS
// ============================================
export const getUserCollectionsController = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Only owner can view their saved products
    if (currentUserId !== user._id.toString()) {
      res.status(403).json({
        success: false,
        message: "You can only view your own collections",
      });
      return;
    }

    const savedProductIds = user.savedProducts || [];
    const total = savedProductIds.length;

    // Paginate the saved product IDs
    const paginatedIds = savedProductIds.slice(skip, skip + limit);

    const products = await Product.find({
      _id: { $in: paginatedIds },
    })
      .populate("topics", "name slug")
      .populate("makers", "fullname email")
      .lean();

    // Add upvoteTrue for current user
    const productsWithStatus = products.map((product: any) => {
      const upvoteTrue = currentUserId
        ? product.upvotedBy?.some(
            (id: any) => id.toString() === currentUserId
          )
          ? 1
          : 0
        : 0;

      const { upvotedBy, ...rest } = product;
      return { ...rest, upvoteTrue };
    });

    res.status(200).json({
      success: true,
      data: productsWithStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching user collections",
      error: error.message,
    });
  }
};

// ============================================
// GET USER'S OWN PRODUCTS (MAKER)
// ============================================
export const getUserProductsController = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const userId = user._id;

    // Products where user is a maker
    const query: any = { makers: userId };
    
    // If viewing own profile, show all statuses; otherwise only approved
    if (currentUserId !== user._id.toString()) {
      query.status = "approved";
    }

    const products = await Product.find(query)
      .populate("topics", "name slug")
      .populate("makers", "fullname email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);

    // Add upvoteTrue for current user
    const productsWithStatus = products.map((product: any) => {
      const upvoteTrue = currentUserId
        ? product.upvotedBy?.some(
            (id: any) => id.toString() === currentUserId
          )
          ? 1
          : 0
        : 0;

      const { upvotedBy, ...rest } = product;
      return { ...rest, upvoteTrue };
    });

    res.status(200).json({
      success: true,
      data: productsWithStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        limit,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching user products",
      error: error.message,
    });
  }
};