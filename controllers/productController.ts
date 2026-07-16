

import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/productSchema.js";
import Subcategory from "../models/subcategorySchema.js";
import User from "../models/userSchema.js";
import { uploadToCloudinary, uploadMultipleToCloudinary, deleteByUrl } from "../utils/uploadToCloudinary.js";
import { createNotification, upsertNotification, removeNotificationIfExists } from "./notificationController.js";

export async function createProductController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Handle both JSON and form-data formats for links
    let {
      name,
      tagline,
      slug,
      description,
      links,
      firstComment,
      makers,
      topics, 
      pricingType,
      isOpenSource,
      isAiProduct,
      scheduledLaunchDate,
    } = req.body;

    // Handle form-data dot notation (links.website, links.appStore, etc.)
    if (!links && req.body['links.website']) {
      links = {
        website: req.body['links.website']
      };
    }

    // Handle makers and topics - convert strings to arrays if needed
    if (typeof makers === 'string') {
      makers = makers.includes(',') ? makers.split(',').map(id => id.trim()) : [makers];
    }
    if (typeof topics === 'string') {
      topics = topics.includes(',') ? topics.split(',').map(id => id.trim()) : [topics];
    }

    // Handle file uploads (thumbnail and gallery) — uploaded to Cloudinary
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let thumbnail = req.body.thumbnail; // URL from body (if not uploading)
    let gallery = req.body.gallery ? JSON.parse(req.body.gallery) : []; // URLs from body

    // Upload thumbnail to Cloudinary if a file was provided
    if (files?.thumbnail && files.thumbnail[0]) {
      const thumbResult = await uploadToCloudinary(files.thumbnail[0].buffer, {
        folder: "products/thumbnails",
      });
      thumbnail = thumbResult.secure_url;
    }

    // Upload gallery images to Cloudinary if provided
    if (files?.gallery && files.gallery.length > 0) {
      const galleryResults = await uploadMultipleToCloudinary(files.gallery, {
        folder: "products/gallery",
      });
      gallery = galleryResults.map((r) => r.secure_url);
    }

    // Validate required fields
    if (!name || !tagline || !description || !links?.website) {
      res.status(400).json({
        success: false,
        message: `Missing required fields: name, tagline, description, and website link are required`,
      });
      return;
    }

    // Validate thumbnail is provided (either uploaded or URL)
    if (!thumbnail) {
      res.status(400).json({
        success: false,
        message: "Thumbnail is required (either upload a file or provide a URL)",
      });
      return;
    }

    // Validate makers (required)
    if (!makers || !Array.isArray(makers) || makers.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one maker is required",
      });
      return;
    }

    // Validate topics (required, 1-3)
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one category is required",
      });
      return;
    }

    if (topics.length > 3) {
      res.status(400).json({
        success: false,
        message: "Maximum 3 categories allowed",
      });
      return;
    }

    // Validate character limits
    if (name.length > 40) {
      res.status(400).json({
        success: false,
        message: "Product name cannot exceed 40 characters",
      });
      return;
    }

    if (tagline.length > 60) {
      res.status(400).json({
        success: false,
        message: "Tagline cannot exceed 60 characters",
      });
      return;
    }

    // Validate topics exist and are approved
    const validTopics = await Subcategory.find({
      _id: { $in: topics },
      status: "approved",
    });

    if (validTopics.length !== topics.length) {
      res.status(400).json({
        success: false,
        message: "One or more categories are invalid or not approved",
      });
      return;
    }

    // Validate makers exist
    const validMakers = await User.find({ _id: { $in: makers } });
    if (validMakers.length !== makers.length) {
      res.status(400).json({
        success: false,
        message: "One or more makers are invalid. Please ensure all maker IDs exist in the database.",
      });
      return;
    }

    // Check if slug already exists
    const slugToUse = slug || name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const existingProduct = await Product.findOne({ slug: slugToUse });
    if (existingProduct) {
      res.status(400).json({
        success: false,
        message: "A product with this name/slug already exists",
      });
      return;
    }

    // Parse links if it's a string
    const linksData = typeof links === 'string' ? JSON.parse(links) : links;

    // Determine product status and launchedAt
    const productStatus = req.body.status || "pending";
    const productData: any = {
      name,
      tagline,
      slug: slugToUse,
      description,
      links: {
        website: linksData.website
      },
      thumbnail,
      gallery: gallery || [],
      firstComment,
      makers: makers,
      topics: topics,
      pricingType,
      isOpenSource: isOpenSource || false,
      isAiProduct: isAiProduct || false,
      status: productStatus,
      scheduledLaunchDate: scheduledLaunchDate || null,
    };

    // Set launchedAt if status is approved
    if (productStatus === "approved") {
      // Use scheduledLaunchDate if provided, otherwise use current date
      productData.launchedAt = scheduledLaunchDate ? new Date(scheduledLaunchDate) : new Date();
    }

    // Create product
    const product = await Product.create(productData);

    // Populate makers and topics - refetch the product with populated fields
    const populatedProduct = await Product.findById(product._id)
      .populate("makers", "fullname email")
      .populate("topics", "name slug");

    res.status(201).json({
      success: true,
      message: "Product submitted successfully",
      data: populatedProduct,
    });
  } catch (error) {
    // Handle Mongoose validation errors
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Server error";
    console.error("[createProductController] Error:", error);
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Get all products with filters
 * GET /api/products
 */
export async function getProductsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { status, topic, maker, pricingType, isAiProduct } = req.query;
    const userId = (req as any).user?.id || null;

    // ── Parse & validate pagination ────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    // ── Build filter ───────────────────────────────────────────────────────
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (topic) filter.topics = topic;
    if (maker) filter.makers = maker;
    if (pricingType) filter.pricingType = pricingType;
    if (isAiProduct !== undefined) filter.isAiProduct = isAiProduct === "true";

    // ── Fetch products (lean for performance) ──────────────────────────────
    const products = await Product.find(filter)
      .select("name slug tagline thumbnail upvotes commentsCount topics makers createdAt launchedAt") // only needed fields
      .populate("makers", "fullname email")
      .populate("topics", "name slug")
      .sort({ launchedAt: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean({ virtuals: false })
      .exec();

    // ── Batch upvote check (single query instead of per-product array fetch) ─
    let upvotedProductIds = new Set<string>();
    if (userId && products.length > 0) {
      try {
        const productIds = products.map((p: any) => p._id);
        const upvotedDocs = await Product.find({ _id: { $in: productIds }, upvotedBy: userId })
          .select("_id")
          .lean()
          .exec();
        upvotedProductIds = new Set(upvotedDocs.map((d) => d._id.toString()));
      } catch (err: any) {
        console.error("[getProductsController] batch upvote query failed:", err.message, err);
      }
    }

    const productsWithUpvote = products.map((p: any) => ({
      ...p,
      upvoteTrue: upvotedProductIds.has(p._id.toString()) ? 1 : 0,
    }));

    // ── Count total (for pagination) ───────────────────────────────────────
    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: {
        products: productsWithUpvote,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    console.error("[getProductsController] Error:", error);
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

export async function deleteProductController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }
    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}
/**
 * Get single product by slug
 * GET /api/products/:slug
 */
export async function getProductBySlugController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { slug } = req.params;
    const userId = (req as any).user?.id || null; // Get authenticated user ID if available

    const product = await Product.findOne({ slug })
      .populate("makers", "fullname email avatar")
      .populate("topics", "name slug icon description");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    // Add upvoteTrue field to product
    const productObj: any = product.toObject();
    
    // Check if user has upvoted: 1 = yes, 0 = no
    if (userId && productObj.upvotedBy && Array.isArray(productObj.upvotedBy)) {
      productObj.upvoteTrue = productObj.upvotedBy.some(
        (id: any) => id.toString() === userId
      ) ? 1 : 0;
    } else {
      productObj.upvoteTrue = 0;
    }

    // Check if user has saved this product
    productObj.isSaved = false;
    if (userId) {
      const currentUser = await User.findById(userId).select("savedProducts");
      if (currentUser && (currentUser as any).savedProducts) {
        productObj.isSaved = (currentUser as any).savedProducts.some(
          (savedId: any) => savedId.toString() === product._id.toString()
        );
      }
    }

    // Remove upvotedBy array from response for privacy
    delete productObj.upvotedBy;

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: productObj,
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
 * Get product by ID (Admin)
 * GET /api/products/admin/:id
 */
export async function getProductByIdController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await Product.findById(id)
      .populate("makers", "fullname email avatar")
      .populate("topics", "name slug icon description");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: product,
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
 * Update product status (admin only)
 * PATCH /api/products/:id/status
 */
export async function updateProductStatusController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status, scheduledLaunchDate } = req.body;

    if (!["draft", "pending", "approved", "rejected"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
      return;
    }

    // Find existing product to check current state
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    const updateData: any = { status };
    
    // Set launchedAt when approving (only if not already set)
    if (status === "approved" && !existingProduct.launchedAt) {
      // Use scheduledLaunchDate if provided, otherwise use existing createdAt to preserve original date
      if (scheduledLaunchDate) {
        updateData.launchedAt = new Date(scheduledLaunchDate);
        updateData.scheduledLaunchDate = scheduledLaunchDate;
      } else {
        // Use createdAt date to preserve the original submission date
        updateData.launchedAt = existingProduct.createdAt;
      }
    }
    
    // Update scheduledLaunchDate if provided (even if already approved)
    if (scheduledLaunchDate && status === "approved") {
      updateData.scheduledLaunchDate = scheduledLaunchDate;
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("makers", "fullname email")
      .populate("topics", "name slug");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: product,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

export async function upvoteProductController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const product = await Product.findById(id);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    // Check if user has already upvoted
    const hasUpvoted = product.upvotedBy.some(
      (upvoterId: mongoose.Types.ObjectId) => upvoterId.toString() === userId
    );

    let updatedProduct;
    let message: string;

    if (hasUpvoted) {
      updatedProduct = await Product.findByIdAndUpdate(
        id,
        {
          $pull: { upvotedBy: userId },
          $inc: { upvotes: -1 },
        },
        { new: true }
      );
      message = "Upvote removed successfully";

      // Remove the upvote notification when toggled off
      if (product.makers && product.makers.length > 0) {
        for (const makerId of product.makers) {
          await removeNotificationIfExists({
            recipient: makerId.toString(),
            actor:     userId,
            type:      "upvote_product",
            entityId:  product._id.toString(),
          });
        }
      }
    } else {
      // Add upvote
      updatedProduct = await Product.findByIdAndUpdate(
        id,
        {
          $addToSet: { upvotedBy: userId },
          $inc: { upvotes: 1 },
        },
        { new: true }
      );
      message = "upvoted successfully";

      // Upsert notification (no duplicates if user re-upvotes)
      if (product.makers && product.makers.length > 0) {
        const actor = await User.findById(userId).select("fullname username");
        const actorName = actor?.fullname || "Someone";
        for (const makerId of product.makers) {
          await upsertNotification({
            recipient:  makerId.toString(),
            actor:      userId,
            type:       "upvote_product",
            message:    `${actorName} upvoted ${product.name}`,
            entityId:   product._id.toString(),
            entityType: "product",
            link:       `/products/${product.slug}`,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message,
      data: {
        product: updatedProduct,
        hasUpvoted: !hasUpvoted,
        userId: userId,
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
 * Get home page products - returns all categories in one response
 * GET /api/products/home
 */
export async function getHomePageProductsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as any).user?.id || null; // Get authenticated user ID if available
    const now = new Date();

    // Today's products (only today)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Yesterday's products (only yesterday)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    // Last week's date range (7 days ago to 2 days ago, excluding today and yesterday)
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);
    
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const lastWeekEnd = new Date(twoDaysAgo.getFullYear(), twoDaysAgo.getMonth(), twoDaysAgo.getDate(), 23, 59, 59);

    // Last month's date range (30 days ago to 8 days ago, excluding last week)
    const lastMonthStart = new Date(now);
    lastMonthStart.setDate(lastMonthStart.getDate() - 30);
    lastMonthStart.setHours(0, 0, 0, 0);
    
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    const lastMonthEnd = new Date(eightDaysAgo.getFullYear(), eightDaysAgo.getMonth(), eightDaysAgo.getDate(), 23, 59, 59);

    // Query all categories in parallel
    const [todayProducts, yesterdayProducts, lastWeekProducts, lastMonthProducts] = await Promise.all([
      // Products launching today only
      Product.find({
        status: "approved",
        $or: [
          {
            launchedAt: {
              $gte: todayStart,
              $lte: todayEnd,
            },
          },
          {
            launchedAt: null,
            createdAt: {
              $gte: todayStart,
              $lte: todayEnd,
            },
          },
        ],
      })
        .select("name slug thumbnail upvotes commentsCount topics tagline upvotedBy")
        .populate("topics", "name slug")
        .sort({ launchedAt: -1, upvotes: -1 })
        .limit(10),

      // Yesterday's top products only
      Product.find({
        status: "approved",
        $or: [
          {
            launchedAt: {
              $gte: yesterdayStart,
              $lte: yesterdayEnd,
            },
          },
          {
            launchedAt: null,
            createdAt: {
              $gte: yesterdayStart,
              $lte: yesterdayEnd,
            },
          },
        ],
      })
        .select("name slug thumbnail upvotes commentsCount topics tagline upvotedBy")
        .populate("topics", "name slug")
        .sort({ upvotes: -1, launchedAt: -1 })
        .limit(7),

      // Last week's top products (days 2-7, excluding today and yesterday)
      Product.find({
        status: "approved",
        $or: [
          {
            launchedAt: {
              $gte: lastWeekStart,
              $lte: lastWeekEnd,
            },
          },
          {
            launchedAt: null,
            createdAt: {
              $gte: lastWeekStart,
              $lte: lastWeekEnd,
            },
          },
        ],
      })
        .select("name slug thumbnail upvotes commentsCount topics tagline upvotedBy")
        .populate("topics", "name slug")
        .sort({ upvotes: -1, launchedAt: -1 })
        .limit(7),

      // Last month's top products (days 8-30, excluding last week)
      Product.find({
        status: "approved",
        $or: [
          {
            launchedAt: {
              $gte: lastMonthStart,
              $lte: lastMonthEnd,
            },
          },
          {
            launchedAt: null,
            createdAt: {
              $gte: lastMonthStart,
              $lte: lastMonthEnd,
            },
          },
        ],
      })
        .select("name slug thumbnail upvotes commentsCount topics tagline upvotedBy")
        .populate("topics", "name slug")
        .sort({ upvotes: -1, launchedAt: -1 })
        .limit(7),
    ]);

    // Helper function to add upvoteTrue status
    const addUpvoteStatus = (products: any[]) => {
      return products.map((product) => {
        const productObj: any = product.toObject();
        if (userId && productObj.upvotedBy && Array.isArray(productObj.upvotedBy)) {
          productObj.upvoteTrue = productObj.upvotedBy.some(
            (id: any) => id.toString() === userId
          ) ? 1 : 0;
        } else {
          productObj.upvoteTrue = 0;
        }
        return productObj;
      });
    };

    res.status(200).json({
      success: true,
      data: {
        today: {
          title: "Top Products Launching Today",
          count: todayProducts.length,
          products: addUpvoteStatus(todayProducts),
        },
        yesterday: {
          title: "Yesterday's Top Products",
          count: yesterdayProducts.length,
          products: addUpvoteStatus(yesterdayProducts),
        },
        lastWeek: {
          title: "Last Week's Top Products",
          count: lastWeekProducts.length,
          products: addUpvoteStatus(lastWeekProducts),
        },
        lastMonth: {
          title: "Last Month's Top Products",
          count: lastMonthProducts.length,
          products: addUpvoteStatus(lastMonthProducts),
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
 * Get product alternatives (products with similar topics)
 * GET /api/products/:slug/alternatives
 */
export async function getProductAlternativesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { slug } = req.params;
    const { sort = "most-upvoted", limit = 10, page = 1 } = req.query;
    const userId = (req as any).user?.id || null;

    const product = await Product.findOne({ slug, status: "approved" });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    const sortOptions: Record<string, any> = {
      "most-upvoted": { upvotes: -1 },
      "highest-rated": { averageRating: -1 },
      "most-recent": { launchedAt: -1 },
    };

    const skip = (Number(page) - 1) * Number(limit);
    const alternatives = await Product.find({
      _id: { $ne: product._id },
      topics: { $in: product.topics },
      status: "approved",
    })
      .populate("topics", "name slug")
      .sort(sortOptions[sort as string] || sortOptions["most-upvoted"])
      .limit(Number(limit))
      .skip(skip);

    const total = await Product.countDocuments({
      _id: { $ne: product._id },
      topics: { $in: product.topics },
      status: "approved",
    });

    const productsWithUpvote = alternatives.map((p) => {
      const obj: any = p.toObject();
      obj.upvoteTrue = userId && obj.upvotedBy?.some((id: any) => id.toString() === userId) ? 1 : 0;
      delete obj.upvotedBy;
      return obj;
    });

    res.status(200).json({
      success: true,
      message: "Alternatives fetched successfully",
      data: {
        product: { _id: product._id, name: product.name, slug: product.slug },
        alternatives: productsWithUpvote,
        pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

/**
 * Get product launches (product's launch history - for now returns the product itself)
 * GET /api/products/:slug/launches
 */
export async function getProductLaunchesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { slug } = req.params;
    const { sort = "launch-date" } = req.query;
    const userId = (req as any).user?.id || null;

    const product = await Product.findOne({ slug, status: "approved" })
      .populate("topics", "name slug")
      .populate("makers", "fullname email");

    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    const productObj: any = product.toObject();
    productObj.upvoteTrue = userId && productObj.upvotedBy?.some((id: any) => id.toString() === userId) ? 1 : 0;
    delete productObj.upvotedBy;

    // Return product as a single launch (products can be relaunched)
    const launches = [productObj];

    res.status(200).json({
      success: true,
      message: "Launches fetched successfully",
      data: {
        product: { _id: product._id, name: product.name, slug: product.slug },
        launches,
        launchCount: launches.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

/**
 * Get product team/makers
 * GET /api/products/:slug/team
 */
export async function getProductTeamController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, status: "approved" })
      .populate("makers", "fullname email role createdAt");

    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    // Get other products made by these makers
    const makerIds = product.makers.map((m: any) => m._id);
    const makerProducts = await Product.find({
      makers: { $in: makerIds },
      status: "approved",
    }).select("name slug thumbnail makers");

    // Build team members with their products
    const teamMembers = product.makers.map((maker: any) => {
      const otherProducts = makerProducts
        .filter((p) => p.makers.some((m: any) => m.toString() === maker._id.toString()) && p.slug !== slug)
        .map((p) => ({ name: p.name, slug: p.slug, thumbnail: p.thumbnail }));

      return {
        _id: maker._id,
        name: maker.fullname,
        email: maker.email,
        role: maker.role || "Maker",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(maker.fullname)}&background=random`,
        product: { name: product.name, slug: product.slug, thumbnail: product.thumbnail },
        otherProducts,
      };
    });

    res.status(200).json({
      success: true,
      message: "Team fetched successfully",
      data: {
        product: { _id: product._id, name: product.name, slug: product.slug, thumbnail: product.thumbnail },
        team: teamMembers,
        teamCount: teamMembers.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

/**
 * Update product (Admin)
 * PUT /api/products/:id
 */
export async function updateProductController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    let {
      name,
      tagline,
      slug,
      description,
      links,
      firstComment,
      makers,
      topics,
      pricingType,
      isOpenSource,
      isAiProduct,
      scheduledLaunchDate,
    } = req.body;

    // Find existing product
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    // Handle form-data dot notation for links
    if (!links && req.body['links.website']) {
      links = {
        website: req.body['links.website']
      };
    }

    // Handle makers and topics - convert strings to arrays if needed
    if (typeof makers === 'string') {
      makers = makers.includes(',') ? makers.split(',').map(id => id.trim()) : [makers];
    } else if (makers === undefined) {
      makers = product.makers; // Keep existing
    }
    
    if (typeof topics === 'string') {
      topics = topics.includes(',') ? topics.split(',').map(id => id.trim()) : [topics];
    } else if (topics === undefined) {
      topics = product.topics; // Keep existing
    }

    // Handle file uploads (thumbnail and gallery) — uploaded to Cloudinary
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let thumbnail = req.body.thumbnail;
    let gallery = req.body.gallery ? JSON.parse(req.body.gallery) : undefined;
    let existingGallery = req.body.existingGallery ? JSON.parse(req.body.existingGallery) : [];

    // Upload new thumbnail to Cloudinary
    if (files?.thumbnail && files.thumbnail[0]) {
      // Delete old thumbnail if it was on Cloudinary
      if (product.thumbnail?.includes("res.cloudinary.com")) {
        deleteByUrl(product.thumbnail).catch((err) =>
          console.warn("[Cloudinary] Failed to delete old thumbnail:", err)
        );
      }
      const thumbResult = await uploadToCloudinary(files.thumbnail[0].buffer, {
        folder: "products/thumbnails",
      });
      thumbnail = thumbResult.secure_url;
    } else if (thumbnail === undefined) {
      thumbnail = product.thumbnail; // Keep existing
    }

    // Handle gallery: merge existing URLs with new uploaded files
    if (files?.gallery && files.gallery.length > 0) {
      const galleryResults = await uploadMultipleToCloudinary(files.gallery, {
        folder: "products/gallery",
      });
      const newGalleryUrls = galleryResults.map((r) => r.secure_url);
      // Merge existing gallery URLs with new uploads
      gallery = [...existingGallery, ...newGalleryUrls];
    } else if (existingGallery.length > 0) {
      // Only existing gallery, no new files
      gallery = existingGallery;
    } else if (gallery === undefined) {
      gallery = product.gallery; // Keep existing
    }

    // Update fields
    if (name) product.name = name;
    if (tagline) product.tagline = tagline;
    if (description) product.description = description;
    if (thumbnail) product.thumbnail = thumbnail;
    if (gallery !== undefined) product.gallery = gallery;
    if (firstComment !== undefined) product.firstComment = firstComment;
    if (makers) product.makers = makers;
    if (topics) product.topics = topics;
    if (pricingType !== undefined) product.pricingType = pricingType;
    if (isOpenSource !== undefined) product.isOpenSource = isOpenSource === 'true' || isOpenSource === true;
    if (isAiProduct !== undefined) product.isAiProduct = isAiProduct === 'true' || isAiProduct === true;
    if (scheduledLaunchDate !== undefined) product.scheduledLaunchDate = scheduledLaunchDate;

    // Handle links update
    if (links) {
      const linksData = typeof links === 'string' ? JSON.parse(links) : links;
      product.links = {
        ...product.links,
        ...linksData
      };
    }

    // Handle slug update - sanitize and check uniqueness
    if (slug && slug !== product.slug) {
      const sanitizedSlug = slug
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      
      if (sanitizedSlug) {
        const existingProduct = await Product.findOne({ 
          slug: sanitizedSlug, 
          _id: { $ne: id } 
        });
        
        if (existingProduct) {
          res.status(400).json({
            success: false,
            message: "A product with this slug already exists",
          });
          return;
        }
        product.slug = sanitizedSlug;
      }
    }

    await product.save();

    // Populate makers and topics
    const populatedProduct = await Product.findById(product._id)
      .populate("makers", "fullname email")
      .populate("topics", "name slug");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: populatedProduct,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    console.error("[updateProductController] Error:", error);
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

// ========================================================================
// CLOUDINARY-BASED PRODUCT CONTROLLERS
// These use memory storage (req.file.buffer) and upload to Cloudinary.
// ========================================================================

/**
 * Create a product with Cloudinary media uploads
 * POST /api/products/cloudinary
 */
export async function createProductCloudinaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    let {
      name,
      tagline,
      slug,
      description,
      links,
      firstComment,
      makers,
      topics,
      pricingType,
      isOpenSource,
      isAiProduct,
      scheduledLaunchDate,
    } = req.body;

    // Handle form-data dot notation (links.website, links.appStore, etc.)
    if (!links && req.body['links.website']) {
      links = {
        website: req.body['links.website']
      };
    }

    // Handle makers and topics - convert strings to arrays if needed
    if (typeof makers === 'string') {
      makers = makers.includes(',') ? makers.split(',').map(id => id.trim()) : [makers];
    }
    if (typeof topics === 'string') {
      topics = topics.includes(',') ? topics.split(',').map(id => id.trim()) : [topics];
    }

    // Handle file uploads (thumbnail and gallery) — Cloudinary
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let thumbnail = req.body.thumbnail;
    let gallery: string[] = req.body.gallery ? JSON.parse(req.body.gallery) : [];

    const {
      uploadToCloudinary,
      uploadMultipleToCloudinary,
    } = await import("../utils/uploadToCloudinary.js");

    // Upload thumbnail to Cloudinary if a file was provided
    if (files?.thumbnail && files.thumbnail[0]) {
      const thumbResult = await uploadToCloudinary(files.thumbnail[0].buffer, {
        folder: "products/thumbnails",
      });
      thumbnail = thumbResult.secure_url;
    }

    // Upload gallery images to Cloudinary if provided
    if (files?.gallery && files.gallery.length > 0) {
      const galleryResults = await uploadMultipleToCloudinary(files.gallery, {
        folder: "products/gallery",
      });
      gallery = galleryResults.map((r) => r.secure_url);
    }

    // Validate required fields
    if (!name || !tagline || !description || !links?.website) {
      res.status(400).json({
        success: false,
        message: `Missing required fields: name, tagline, description, and website link are required`,
      });
      return;
    }

    if (!thumbnail) {
      res.status(400).json({
        success: false,
        message: "Thumbnail is required (either upload a file or provide a URL)",
      });
      return;
    }

    if (!makers || !Array.isArray(makers) || makers.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one maker is required",
      });
      return;
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one category is required",
      });
      return;
    }

    if (topics.length > 3) {
      res.status(400).json({
        success: false,
        message: "Maximum 3 categories allowed",
      });
      return;
    }

    if (name.length > 40) {
      res.status(400).json({
        success: false,
        message: "Product name cannot exceed 40 characters",
      });
      return;
    }

    if (tagline.length > 60) {
      res.status(400).json({
        success: false,
        message: "Tagline cannot exceed 60 characters",
      });
      return;
    }

    // Validate topics exist and are approved
    const validTopics = await Subcategory.find({
      _id: { $in: topics },
      status: "approved",
    });

    if (validTopics.length !== topics.length) {
      res.status(400).json({
        success: false,
        message: "One or more categories are invalid or not approved",
      });
      return;
    }

    // Validate makers exist
    const validMakers = await User.find({ _id: { $in: makers } });
    if (validMakers.length !== makers.length) {
      res.status(400).json({
        success: false,
        message: "One or more makers are invalid",
      });
      return;
    }

    // Check if slug already exists
    const slugToUse = slug || name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const existingProduct = await Product.findOne({ slug: slugToUse });
    if (existingProduct) {
      res.status(400).json({
        success: false,
        message: "A product with this name/slug already exists",
      });
      return;
    }

    const linksData = typeof links === 'string' ? JSON.parse(links) : links;
    const productStatus = req.body.status || "pending";
    const productData: any = {
      name,
      tagline,
      slug: slugToUse,
      description,
      links: { website: linksData.website },
      thumbnail,
      gallery: gallery || [],
      firstComment,
      makers,
      topics,
      pricingType,
      isOpenSource: isOpenSource || false,
      isAiProduct: isAiProduct || false,
      status: productStatus,
      scheduledLaunchDate: scheduledLaunchDate || null,
    };

    if (productStatus === "approved") {
      productData.launchedAt = scheduledLaunchDate ? new Date(scheduledLaunchDate) : new Date();
    }

    const product = await Product.create(productData);

    const populatedProduct = await Product.findById(product._id)
      .populate("makers", "fullname email")
      .populate("topics", "name slug");

    res.status(201).json({
      success: true,
      message: "Product submitted successfully",
      data: populatedProduct,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

/**
 * Update a product with Cloudinary media uploads
 * PUT /api/products/cloudinary/:id
 */
export async function updateProductCloudinaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    let {
      name,
      tagline,
      slug,
      description,
      links,
      firstComment,
      makers,
      topics,
      pricingType,
      isOpenSource,
      isAiProduct,
      scheduledLaunchDate,
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    if (!links && req.body['links.website']) {
      links = { website: req.body['links.website'] };
    }

    if (typeof makers === 'string') {
      makers = makers.includes(',') ? makers.split(',').map(id => id.trim()) : [makers];
    } else if (makers === undefined) {
      makers = product.makers;
    }

    if (typeof topics === 'string') {
      topics = topics.includes(',') ? topics.split(',').map(id => id.trim()) : [topics];
    } else if (topics === undefined) {
      topics = product.topics;
    }

    // Handle file uploads via Cloudinary
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let thumbnail = req.body.thumbnail;
    let gallery = req.body.gallery ? JSON.parse(req.body.gallery) : undefined;
    let existingGallery = req.body.existingGallery ? JSON.parse(req.body.existingGallery) : [];

    const {
      uploadToCloudinary,
      uploadMultipleToCloudinary,
      deleteByUrl,
    } = await import("../utils/uploadToCloudinary.js");

    // Upload new thumbnail to Cloudinary
    if (files?.thumbnail && files.thumbnail[0]) {
      // Delete old thumbnail if it was on Cloudinary
      if (product.thumbnail?.includes("res.cloudinary.com")) {
        deleteByUrl(product.thumbnail).catch((err) =>
          console.warn("[Cloudinary] Failed to delete old thumbnail:", err)
        );
      }
      const thumbResult = await uploadToCloudinary(files.thumbnail[0].buffer, {
        folder: "products/thumbnails",
      });
      thumbnail = thumbResult.secure_url;
    } else if (thumbnail === undefined) {
      thumbnail = product.thumbnail;
    }

    // Handle gallery: merge existing URLs with new uploaded files
    if (files?.gallery && files.gallery.length > 0) {
      const galleryResults = await uploadMultipleToCloudinary(files.gallery, {
        folder: "products/gallery",
      });
      const newGalleryUrls = galleryResults.map((r) => r.secure_url);
      gallery = [...existingGallery, ...newGalleryUrls];
    } else if (existingGallery.length > 0) {
      gallery = existingGallery;
    } else if (gallery === undefined) {
      gallery = product.gallery;
    }

    // Update fields
    if (name) product.name = name;
    if (tagline) product.tagline = tagline;
    if (description) product.description = description;
    if (thumbnail) product.thumbnail = thumbnail;
    if (gallery !== undefined) product.gallery = gallery;
    if (firstComment !== undefined) product.firstComment = firstComment;
    if (makers) product.makers = makers;
    if (topics) product.topics = topics;
    if (pricingType !== undefined) product.pricingType = pricingType;
    if (isOpenSource !== undefined) product.isOpenSource = isOpenSource === 'true' || isOpenSource === true;
    if (isAiProduct !== undefined) product.isAiProduct = isAiProduct === 'true' || isAiProduct === true;
    if (scheduledLaunchDate !== undefined) product.scheduledLaunchDate = scheduledLaunchDate;

    if (links) {
      const linksData = typeof links === 'string' ? JSON.parse(links) : links;
      product.links = { ...product.links, ...linksData };
    }

    if (slug && slug !== product.slug) {
      const sanitizedSlug = slug
        .toLowerCase().trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (sanitizedSlug) {
        const existingProduct = await Product.findOne({ slug: sanitizedSlug, _id: { $ne: id } });
        if (existingProduct) {
          res.status(400).json({ success: false, message: "A product with this slug already exists" });
          return;
        }
        product.slug = sanitizedSlug;
      }
    }

    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate("makers", "fullname email")
      .populate("topics", "name slug");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: populatedProduct,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

export async function saveProductController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Resolve product by id or slug
    let product = null as any;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ slug: id });
    }

    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Ensure savedProducts array exists on user
    const savedArr: mongoose.Types.ObjectId[] = (user as any).savedProducts || [];
    const prodIdStr = product._id.toString();
    const existingIndex = savedArr.findIndex((p: any) => p.toString() === prodIdStr);

    let saved = false;
    if (existingIndex >= 0) {
      // Unsave
      savedArr.splice(existingIndex, 1);
      saved = false;
    } else {
      // Save
      savedArr.push(product._id);
      saved = true;
    }

    (user as any).savedProducts = savedArr;
    await user.save();

    res.status(200).json({
      success: true,
      message: saved ? "Product saved successfully" : "Product unsaved successfully",
      saved,
      savedCount: savedArr.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

export default {
  createProductController,
  getProductsController,
  getProductBySlugController,
  getProductByIdController,
  updateProductController,
  updateProductStatusController,
  upvoteProductController,
  deleteProductController,
  getHomePageProductsController,
  getProductAlternativesController,
  getProductLaunchesController,
  getProductTeamController,
  saveProductController,
  createProductCloudinaryController,
  updateProductCloudinaryController,
};
