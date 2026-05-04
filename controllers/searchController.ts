import { Request, Response } from "express";
import Product from "../models/productSchema.js";
import User from "../models/userSchema.js";
import Category from "../models/categorySchema.js";
import Subcategory from "../models/subcategorySchema.js";

/**
 * Global search controller — searches products, users, categories,
 * subcategories in a single request.
 *
 * GET /api/search?q=<query>&limit=<number>
 */
export async function globalSearchController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Search query 'q' is required",
      });
      return;
    }

    const query = q.trim();
    const resultLimit = Math.min(Number(limit) || 5, 20);
    const regex = new RegExp(query, "i");

    // Run all searches in parallel for maximum performance
    const [products, users, categories, subcategories] =
      await Promise.all([
        // Search products (only approved)
        Product.find({
          status: "approved",
          $or: [
            { name: regex },
            { tagline: regex },
            { description: regex },
          ],
        })
          .select("name tagline slug thumbnail upvotes commentsCount")
          .populate("topics", "name slug")
          .sort({ upvotes: -1 })
          .limit(resultLimit)
          .lean(),

        // Search users by fullname, username
        User.find({
          $or: [
            { fullname: regex },
            { username: regex },
          ],
        })
          .select("fullname username profileImage headline")
          .limit(resultLimit)
          .lean(),

        // Search categories (only approved)
        Category.find({
          status: "approved",
          $or: [{ name: regex }, { description: regex }],
        })
          .select("name slug description")
          .populate({
            path: "subcategories",
            match: { status: "approved" },
            select: "name slug",
          })
          .limit(resultLimit)
          .lean(),

        // Search subcategories (only approved)
        Subcategory.find({
          status: "approved",
          $or: [{ name: regex }, { description: regex }],
        })
          .select("name slug description category")
          .populate("category", "name slug")
          .limit(resultLimit)
          .lean(),
      ]);

    const totalResults =
      products.length +
      users.length +
      categories.length +
      subcategories.length 

    res.status(200).json({
      success: true,
      message:
        totalResults > 0
          ? `Found ${totalResults} results for "${query}"`
          : `No results found for "${query}"`,
      data: {
        products,
        users,
        categories,
        subcategories,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Server error";
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: errorMessage });
  }
}
