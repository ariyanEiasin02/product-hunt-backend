import { Request, Response } from "express";
import Category from "../models/categorySchema.js";
import Subcategory from "../models/subcategorySchema.js";
import Product from "../models/productSchema.js";

/**
 * Unified Footer Layout Controller
 *
 * Returns all data needed for the footer in a single endpoint:
 *   - Categories (8) with subcategories (4 each)
 *   - Trending categories (5)
 *   - Top reviewed products (5)
 *   - Trending products (5)
 *   - Trending subcategories (5)
 *
 * All queries use lean() + minimal select() for production performance.
 * Runs 5 queries in parallel via Promise.all.
 *
 * GET /api/v1/footer
 */
export async function getLoyoutListController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // ── 1. Categories with subcategories ────────────────────────────────
    const categoriesQuery = Category.find({
      isActive: true,
      status: "approved",
    })
      .select("_id name slug")
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({
        path: "subcategories",
        match: { isActive: true, status: "approved" },
        select: "_id name slug",
        perDocumentLimit: 4,
      })
      .lean()
      .exec();

    // ── 2. Trending categories (top 5) ──────────────────────────────────
    const trendingCategoriesQuery = Category.find({
      isActive: true,
      status: "approved",
    })
      .select("_id name slug")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .exec();

    // ── 3. Top reviewed products (by avg rating + review count) ─────────
    const topReviewedProductsQuery = Product.find({ status: "approved" })
      .select("_id name slug")
      .sort({ averageRating: -1, totalReviews: -1, upvotes: -1 })
      .limit(5)
      .lean()
      .exec();

    // ── 4. Trending products (by upvotes) ────────────────────────────────
    const trendingProductsQuery = Product.find({ status: "approved" })
      .select("_id name slug")
      .sort({ upvotes: -1, launchedAt: -1 })
      .limit(5)
      .lean()
      .exec();

    // ── 5. Trending subcategories (latest active) ───────────────────────
    const trendingSubcategoriesQuery = Subcategory.find({
      isActive: true,
      status: "approved",
    })
      .select("_id name slug")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .exec();

    // ── Run all 5 queries in parallel ───────────────────────────────────
    const [
      categories,
      trendingCategories,
      topReviewedProducts,
      trendingProducts,
      trendingSubcategories,
    ] = await Promise.all([
      categoriesQuery,
      trendingCategoriesQuery,
      topReviewedProductsQuery,
      trendingProductsQuery,
      trendingSubcategoriesQuery,
    ]);

    res.status(200).json({
      success: true,
      data: {
        categories,
        trendingCategories,
        topReviewedProducts,
        trendingProducts,
        trendingSubcategories,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Server error";

    res.status(500).json({
      success: false,
      message: errorMessage,
      data: {
        categories: [],
        trendingCategories: [],
        topReviewedProducts: [],
        trendingProducts: [],
        trendingSubcategories: [],
      },
    });
  }
}
