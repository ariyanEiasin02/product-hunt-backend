import { Request, Response } from "express";
import User from "../models/userSchema.js";
import Product from "../models/productSchema.js";
import Category from "../models/categorySchema.js";
import Subcategory from "../models/subcategorySchema.js";
import Story from "../models/storySchema.js";
import Comment from "../models/commentSchema.js";
import Review from "../models/reviewSchema.js";

// ── GET /api/dashboard/overview ──
export const getDashboardOverview = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Run all count queries in parallel for performance
    const [
      totalUsers,
      totalProducts,
      totalCategories,
      totalSubcategories,
      totalStories,
      totalComments,
      totalReviews,
      pendingProducts,
      approvedProducts,
      rejectedProducts,
      draftProducts,
      publishedStories,
      draftStories,
      activeCategories,
      inactiveCategories,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Category.countDocuments(),
      Subcategory.countDocuments(),
      Story.countDocuments(),
      Comment.countDocuments(),
      Review.countDocuments(),
      Product.countDocuments({ status: "pending" }),
      Product.countDocuments({ status: "approved" }),
      Product.countDocuments({ status: "rejected" }),
      Product.countDocuments({ status: "draft" }),
      Story.countDocuments({ status: "published" }),
      Story.countDocuments({ status: "draft" }),
      Category.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: false }),
    ]);

    // Recent users (last 5)
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("fullname username email profileImage role createdAt");

    // Recent products (last 5)
    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name slug thumbnail status upvotes createdAt")
      .populate("makers", "fullname profileImage");

    // Recent stories (last 5)
    const recentStories = await Story.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title slug coverImage status tags createdAt author");

    // Top products by upvotes (last 5)
    const topProducts = await Product.find({ status: "approved" })
      .sort({ upvotes: -1 })
      .limit(5)
      .select("name slug thumbnail upvotes commentsCount createdAt")
      .populate("makers", "fullname profileImage");

    // Monthly registration stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyUsers = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyProducts = await Product.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayUsers, todayProducts, todayComments, todayReviews] =
      await Promise.all([
        User.countDocuments({ createdAt: { $gte: todayStart } }),
        Product.countDocuments({ createdAt: { $gte: todayStart } }),
        Comment.countDocuments({ createdAt: { $gte: todayStart } }),
        Review.countDocuments({ createdAt: { $gte: todayStart } }),
      ]);

    res.status(200).json({
      success: true,
      data: {
        // Summary stats
        stats: {
          totalUsers,
          totalProducts,
          totalCategories,
          totalSubcategories,
          totalStories,
          totalComments,
          totalReviews,
        },
        // Product breakdown
        productStatus: {
          pending: pendingProducts,
          approved: approvedProducts,
          rejected: rejectedProducts,
          draft: draftProducts,
        },
        // Story breakdown
        storyStatus: {
          published: publishedStories,
          draft: draftStories,
        },
        // Category breakdown
        categoryStatus: {
          active: activeCategories,
          inactive: inactiveCategories,
        },
        // Today's activity
        today: {
          users: todayUsers,
          products: todayProducts,
          comments: todayComments,
          reviews: todayReviews,
        },
        // Monthly trends
        trends: {
          users: monthlyUsers,
          products: monthlyProducts,
        },
        // Recent items
        recentUsers,
        recentProducts,
        recentStories,
        topProducts,
      },
    });
  } catch (error: any) {
    console.error("Dashboard overview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview",
      error: error.message,
    });
  }
};
