import { Request, Response } from "express";
import ProductGuide from "../models/productGuideSchema.js";
import Faq from "../models/faqSchema.js";
import { createFileUrlFromPath } from "../utils/fileUploadHelper.js";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ── GET all guides (admin, paginated) ─────────────────────────────────────────
export async function getAllGuidesController(req: Request, res: Response): Promise<void> {
  try {
    const page   = Math.max(1, parseInt(String(req.query.page  ?? 1), 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));
    const skip   = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { title:{ $regex: search, $options: "i" } },
        { slug:{ $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
      ];
    }
    if (status === "published" || status === "draft") {
      filter.status = status;
    }

    const [guides, total] = await Promise.all([
      ProductGuide.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ProductGuide.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: guides,
      pagination: { total, page, limit, totalPages, hasMore: page < totalPages },
    });
  } catch (err) {
    console.error("[getAllGuides]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET published guides (public) ─────────────────────────────────────────────
export async function getPublishedGuidesController(req: Request, res: Response): Promise<void> {
  try {
    const guides = await ProductGuide.find({ status: "published" }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: guides });
  } catch (err) {
    console.error("[getPublishedGuides]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET published guides + faqs (public) ───────────────────────────────────
export async function getProductGuidesFaqsController(req: Request, res: Response): Promise<void> {
  try {
    const guidesPromise = ProductGuide.find({ status: "published" })
      .sort({ createdAt: -1 })
      .select("_id title slug image shortDescription");
    const faqsPromise   = Faq.find({ status: "published" }).sort({ createdAt: -1 });

    const [guides, faqs] = await Promise.all([guidesPromise, faqsPromise]);

    res.status(200).json({
      success: true,
      data: {
        productGuides: guides,
        faqs: faqs,
      },
    });
  } catch (err) {
    console.error("[getProductGuidesFaqs]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET guide by slug (public) ────────────────────────────────────────────────
export async function getGuideBySlugController(req: Request, res: Response): Promise<void> {
  try {
    const guide = await ProductGuide.findOne({ slug: req.params.slug, status: "published" });
    if (!guide) {
      res.status(404).json({ success: false, message: "Guide not found" });
      return;
    }
    res.status(200).json({ success: true, data: guide });
  } catch (err) {
    console.error("[getGuideBySlug]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET guide by ID (admin) ───────────────────────────────────────────────────
export async function getGuideByIdController(req: Request, res: Response): Promise<void> {
  try {
    const guide = await ProductGuide.findById(req.params.id);
    if (!guide) {
      res.status(404).json({ success: false, message: "Guide not found" });
      return;
    }
    res.status(200).json({ success: true, data: guide });
  } catch (err) {
    console.error("[getGuideById]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── CREATE guide ──────────────────────────────────────────────────────────────
export async function createGuideController(req: Request, res: Response): Promise<void> {
  try {
    const { title, slug, shortDescription, description, status } = req.body;
    if (!title) {
      res.status(400).json({ success: false, message: "Title is required" });
      return;
    }
    const finalSlug = (slug && slug.trim()) ? slug.trim().toLowerCase() : generateSlug(title);

    const exists = await ProductGuide.findOne({ slug: finalSlug });
    if (exists) {
      res.status(400).json({ success: false, message: "Slug already exists. Use a different title or slug." });
      return;
    }

    const imageUrl = req.file ? createFileUrlFromPath(req.file.path) : "";

    const guide = await ProductGuide.create({
      title: title.trim(),
      slug: finalSlug,
      image: imageUrl,
      shortDescription: shortDescription ?? "",
      description: description ?? "",
      status: status ?? "draft",
    });
    res.status(201).json({ success: true, message: "Guide created successfully", data: guide });
  } catch (err) {
    console.error("[createGuide]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── UPDATE guide ──────────────────────────────────────────────────────────────
export async function updateGuideController(req: Request, res: Response): Promise<void> {
  try {
    const guide = await ProductGuide.findById(req.params.id);
    if (!guide) {
      res.status(404).json({ success: false, message: "Guide not found" });
      return;
    }
    const { title, slug, shortDescription, description, status } = req.body;

    const newSlug = (slug && slug.trim())
      ? slug.trim().toLowerCase()
      : (title ? generateSlug(title) : guide.slug);

    if (newSlug !== guide.slug) {
      const exists = await ProductGuide.findOne({ slug: newSlug, _id: { $ne: guide._id } });
      if (exists) {
        res.status(400).json({ success: false, message: "Slug already in use by another guide." });
        return;
      }
    }

    guide.title            = title            ?? guide.title;
    guide.slug             = newSlug;
    guide.image            = req.file ? createFileUrlFromPath(req.file.path) : guide.image;
    guide.shortDescription = shortDescription ?? guide.shortDescription;
    guide.description      = description      ?? guide.description;
    if (status) guide.status = status;
    await guide.save();

    res.status(200).json({ success: true, message: "Guide updated successfully", data: guide });
  } catch (err) {
    console.error("[updateGuide]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── TOGGLE guide status ───────────────────────────────────────────────────────
export async function toggleGuideStatusController(req: Request, res: Response): Promise<void> {
  try {
    const guide = await ProductGuide.findById(req.params.id);
    if (!guide) {
      res.status(404).json({ success: false, message: "Guide not found" });
      return;
    }
    guide.status = guide.status === "published" ? "draft" : "published";
    await guide.save();
    res.status(200).json({ success: true, message: `Guide ${guide.status}`, data: guide });
  } catch (err) {
    console.error("[toggleGuideStatus]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── DELETE guide ──────────────────────────────────────────────────────────────
export async function deleteGuideController(req: Request, res: Response): Promise<void> {
  try {
    const guide = await ProductGuide.findByIdAndDelete(req.params.id);
    if (!guide) {
      res.status(404).json({ success: false, message: "Guide not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Guide deleted successfully" });
  } catch (err) {
    console.error("[deleteGuide]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
