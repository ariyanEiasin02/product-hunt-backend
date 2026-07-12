import e, { Request, Response } from "express";
import Category from "../models/categorySchema.js";
import Subcategory from "../models/subcategorySchema.js";
import Product from "../models/productSchema.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

export async function createCategoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { name, slug, description } = req.body;

    const exists = await Category.findOne({ slug });
    if (exists) {
      res.status(400).json({ success: false, message: "Slug already exists" });
      return;
    }

    const category = await Category.create({
      name,
      slug,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Category created (waiting approval)",
      data: category,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateCategoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, slug, description } = req.body;
    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, message: "Category not found" });
      return;
    }
    category.name = name;
    category.slug = slug;
    category.description = description;
    await category.save();
    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}
export async function getCategoriesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 24), 10) || 20));
    const skip  = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      Category.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Category.countDocuments({}),
    ]);

    res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}
export async function categoryStatusController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    const validStatuses = ["approved", "rejected", "waiting"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: approved, rejected, waiting",
      });
      return;
    }

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, message: "Category not found" });
      return;
    }

    // Set isActive to true only for approved status
    category.status = status;
    category.isActive = status === "approved";
    await category.save();

    res.status(200).json({
      success: true,
      message: "Category status updated successfully",
      data: category,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

export async function categoryDeleteController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, message: "Category not found" });
      return;
    }
    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function createSubcategoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { name, slug, description, category } = req.body;

    // Check if slug already exists
    const exists = await Subcategory.findOne({ slug });
    if (exists) {
      res.status(400).json({ success: false, message: "Slug already exists" });
      return;
    }

    const parentCategory = await Category.findById(category);
    if (!parentCategory) {
      res.status(404).json({ success: false, message: "Category not found" });
      return;
    }

    let image = req.body.image || undefined;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "subcategories",
      });
      image = result.secure_url;
    }

    const subcategory = await Subcategory.create({
      name,
      slug,
      description,
      category,
      image,
    });

    await Category.findByIdAndUpdate(category, {
      $addToSet: { subcategories: subcategory._id },
    });

    res.status(201).json({
      success: true,
      message: "Subcategory created (waiting approval)",
      data: subcategory,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

export async function updateSubCategoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, slug, description, category } = req.body;
    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      res.status(404).json({ success: false, message: "Subcategory not found" });
      return;
    }
    subcategory.name = name;
    subcategory.slug = slug;
    subcategory.description = description;
    subcategory.category = category;
    // Handle image upload to Cloudinary
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "subcategories",
      });
      subcategory.image = result.secure_url;
    } else if (req.body.image) {
      subcategory.image = req.body.image;
    }
    await subcategory.save();
    res.status(200).json({
      success: true,
      message: "Subcategory updated successfully",
      data: subcategory,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}
export async function getSubcategoriesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));
    const skip  = (page - 1) * limit;

    const [subcategories, total] = await Promise.all([
      Subcategory.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Subcategory.countDocuments({}),
    ]);

    res.status(200).json({
      success: true,
      message: "Subcategories fetched successfully",
      data: subcategories,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function subcategoryStatusController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    const validStatuses = ["approved", "rejected", "waiting"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: approved, rejected, waiting",
      });
      return;
    }

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      res.status(404).json({ success: false, message: "Subcategory not found" });
      return;
    }

    // Set isActive to true only for approved status
    subcategory.status = status;
    subcategory.isActive = status === "approved";
    await subcategory.save();

    res.status(200).json({
      success: true,
      message: "Subcategory status updated successfully",
      data: subcategory,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

export async function subcategoryDeleteController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      res.status(404).json({ success: false, message: "Subcategory not found" });
      return;
    }
    await Subcategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function  allGetCategoriesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const categories = await Category.find({ status: "approved" }).populate({
      path: "subcategories",
      match: { status: "approved" },
    });
    res.status(200).json({
      success: true,
      message: "Approved categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}
// get navbar categories and subcategories for the frontend
export async function getNavbarCategoriesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const categories = await Category.find({ status: "approved" })
      .select("_id name slug")
      .limit(8)
      .populate({
        path: "subcategories",
        match: { status: "approved" },
        select: "_id name slug",
       perDocumentLimit: 8,
      });

    res.status(200).json({
      success: true,
      message: "Approved categories fetched successfully",
      data: categories,
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

// Get category detail by slug with products
export async function getCategoryBySlugController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { slug } = req.params;
    const {
      sort = "top-reviewed",
      page = 1,
      limit = 20,
    } = req.query;

    const userId = (req as any).user?.id || null;

    // First check if slug matches a category
    let category = await Category.findOne({ slug, status: "approved" }).populate({
      path: "subcategories",
      match: { status: "approved" },
      options: {
        limit: 6,
      }
    });

    let isSubcategory = false;
    let parentCategory = null;
    let subcategory = null;

    if (!category) {
      // Check if slug matches a subcategory
      subcategory = await Subcategory.findOne({ slug, status: "approved" }).populate("category");
      if (!subcategory) {
        res.status(404).json({ success: false, message: "Category not found" });
        return;
      }
      isSubcategory = true;
      parentCategory = await Category.findById(subcategory.category).populate({
        path: "subcategories",
        match: { status: "approved" },
        options: {
          limit: 6,
        }
      });
    }

    // Build the list of subcategory IDs to query products by
    let subcategoryIds: string[] = [];

    if (isSubcategory) {
      // For a subcategory page, find products tagged with this specific subcategory
      subcategoryIds = [subcategory!._id.toString()];
    } else {
      // For a parent category page, find products tagged with any of its subcategories
      if (category?.subcategories && (category.subcategories as any[]).length > 0) {
        subcategoryIds = (category.subcategories as any[]).map((s: any) => s._id.toString());
      }
    }

    // Build product query
    const productFilter: any = {
      status: "approved",
    };

    if (subcategoryIds.length > 0) {
      productFilter.topics = { $in: subcategoryIds };
    } else {
      // No subcategories found, return empty products
      const categoryData = isSubcategory
        ? {
            _id: subcategory!._id,
            name: subcategory!.name,
            slug: subcategory!.slug,
            description: subcategory!.description,
            isSubcategory: true,
            parentCategory: parentCategory
              ? {
                  _id: parentCategory._id,
                  name: parentCategory.name,
                  slug: parentCategory.slug,
                }
              : null,
            relatedCategories: parentCategory?.subcategories
              ? (parentCategory.subcategories as any[])
                  .filter((s: any) => s.slug !== slug)
                  .map((s: any) => ({
                    _id: s._id,
                    name: s.name,
                    slug: s.slug,
                  }))
              : [],
          }
        : {
            _id: category!._id,
            name: category!.name,
            slug: category!.slug,
            description: category!.description,
            isSubcategory: false,
            subcategories: (category!.subcategories as any[]).map((s: any) => ({
              _id: s._id,
              name: s.name,
              slug: s.slug,
            })),
            relatedCategories: [],
          };

      res.status(200).json({
        success: true,
        message: "Category fetched successfully",
        data: {
          category: categoryData,
          products: [],
          pagination: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            pages: 0,
          },
        },
      });
      return;
    }

    // Sort options
    const sortValue = typeof sort === 'string' ? sort.toLowerCase().trim() : 'top-reviewed';
    
    let sortOption: any = {};
    switch (sortValue) {
      case "top-reviewed":
        sortOption = { averageRating: -1, totalReviews: -1, upvotes: -1 };
        break;
      case "newest":
        sortOption = { launchedAt: -1, createdAt: -1 };
        break;
      case "most-upvoted":
        sortOption = { upvotes: -1, launchedAt: -1 };
        break;
      default:
        sortOption = { averageRating: -1, totalReviews: -1, upvotes: -1 };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Execute query with sort
    const products = await Product.find(productFilter)
      .populate("makers", "fullname email profileImage")
      .populate("topics", "name slug")
      .sort(sortOption)
      .limit(Number(limit))
      .skip(skip);

    // Add upvote status and remove upvotedBy array
    const productsWithUpvoteStatus = products.map((product) => {
      const productObj: any = product.toObject();
      if (userId && productObj.upvotedBy && Array.isArray(productObj.upvotedBy)) {
        productObj.upvoteTrue = productObj.upvotedBy.some(
          (id: any) => id.toString() === userId
        )
          ? 1
          : 0;
      } else {
        productObj.upvoteTrue = 0;
      }
      // Remove upvotedBy array from response for privacy
      delete productObj.upvotedBy;
      return productObj;
    });

    const total = await Product.countDocuments(productFilter);

    // Build category response data
    const categoryData = isSubcategory
      ? {
          _id: subcategory!._id,
          name: subcategory!.name,
          slug: subcategory!.slug,
          description: subcategory!.description,
          isSubcategory: true,
          parentCategory: parentCategory
            ? {
                _id: parentCategory._id,
                name: parentCategory.name,
                slug: parentCategory.slug,
              }
            : null,
          relatedCategories: parentCategory?.subcategories
            ? (parentCategory.subcategories as any[])
                .filter((s: any) => s.slug !== slug)
                .map((s: any) => ({
                  _id: s._id,
                  name: s.name,
                  slug: s.slug,
                }))
            : [],
        }
      : {
          _id: category!._id,
          name: category!.name,
          slug: category!.slug,
          description: category!.description,
          isSubcategory: false,
          subcategories: (category!.subcategories as any[]).map((s: any) => ({
            _id: s._id,
            name: s.name,
            slug: s.slug,
          })),
          relatedCategories: [],
        };

    // Get product logos for the banner (first 6 products)
    const productLogos = productsWithUpvoteStatus.slice(0, 6).map((p: any) => ({
      src: p.thumbnail,
      alt: p.name,
    }));

    res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      data: {
        category: categoryData,
        products: productsWithUpvoteStatus,
        productLogos,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

// Get all approved subcategories (for product submission topic selection)
export async function getApprovedSubcategoriesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const subcategories = await Subcategory.find({ status: "approved" })
      .select("name slug image")
      .populate("category", "name slug")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: "Approved subcategories fetched successfully",
      data: subcategories,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

// Get categories and subcategories as a flat array for React Select dropdown
export async function getCategoriesAndSubcategoriesForSelectController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Fetch approved categories and subcategories in parallel
    const [categories, subcategories] = await Promise.all([
      Category.find({ status: "approved" })
        .select("_id name slug")
        .sort({ name: 1 })
        .lean(),
      Subcategory.find({ status: "approved" })
        .select("_id name slug category")
        .populate("category", "_id name slug")
        .sort({ name: 1 })
        .lean(),
    ]);

    // Map categories to the expected flat format
    const categoryItems = categories.map((cat) => ({
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      type: "category" as const,
    }));

    // Map subcategories with parent category info
    const subcategoryItems = subcategories.map((sub) => {
      const parentCategory = sub.category as unknown as { _id: string; name: string; slug: string } | null;
      return {
        _id: sub._id,
        name: sub.name,
        slug: sub.slug,
        type: "subcategory" as const,
        parentCategory: parentCategory
          ? {
              _id: parentCategory._id,
              name: parentCategory.name,
              slug: parentCategory.slug,
            }
          : null,
      };
    });

    // Combine into a single flat array, sorted alphabetically by name
    const data = [...categoryItems, ...subcategoryItems].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    res.status(200).json({
      success: true,
      message: "Categories and subcategories fetched successfully",
      data,
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