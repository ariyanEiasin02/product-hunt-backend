import { Request, Response } from "express";
import Page from "../models/pageSchema.js";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ── GET all pages (admin, paginated) ──────────────────────────────────────────
export async function getAllPagesController(req: Request, res: Response): Promise<void> {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));
    const skip  = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { slug:  { $regex: search, $options: "i" } },
      ];
    }

    const [pages, total] = await Promise.all([
      Page.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Page.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: pages,
      pagination: { total, page, limit, totalPages, hasMore: page < totalPages },
    });
  } catch (err) {
    console.error("[getAllPages]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET single page by ID (admin) ─────────────────────────────────────────────
export async function getPageByIdController(req: Request, res: Response): Promise<void> {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found" });
      return;
    }
    res.status(200).json({ success: true, data: page });
  } catch (err) {
    console.error("[getPageById]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET published page by slug (public) ──────────────────────────────────────
export async function getPageBySlugController(req: Request, res: Response): Promise<void> {
  try {
    const page = await Page.findOne({ slug: req.params.slug, status: "published" });
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found" });
      return;
    }
    res.status(200).json({ success: true, data: page });
  } catch (err) {
    console.error("[getPageBySlug]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── CREATE page ───────────────────────────────────────────────────────────────
export async function createPageController(req: Request, res: Response): Promise<void> {
  try {
    const { title, slug, content, status } = req.body;

    if (!title) {
      res.status(400).json({ success: false, message: "Title is required" });
      return;
    }

    const finalSlug = (slug && slug.trim()) ? slug.trim().toLowerCase() : generateSlug(title);

    const exists = await Page.findOne({ slug: finalSlug });
    if (exists) {
      res.status(400).json({ success: false, message: "Slug already exists. Please choose a different title or slug." });
      return;
    }

    const page = await Page.create({ title, slug: finalSlug, content: content ?? "", status: status ?? "draft" });

    res.status(201).json({ success: true, message: "Page created successfully", data: page });
  } catch (err) {
    console.error("[createPage]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── UPDATE page ───────────────────────────────────────────────────────────────
export async function updatePageController(req: Request, res: Response): Promise<void> {
  try {
    const { title, slug, content, status } = req.body;

    const page = await Page.findById(req.params.id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found" });
      return;
    }

    const newSlug = (slug && slug.trim()) ? slug.trim().toLowerCase() : (title ? generateSlug(title) : page.slug);

    if (newSlug !== page.slug) {
      const exists = await Page.findOne({ slug: newSlug, _id: { $ne: page._id } });
      if (exists) {
        res.status(400).json({ success: false, message: "Slug already in use by another page." });
        return;
      }
    }

    page.title   = title   ?? page.title;
    page.slug    = newSlug;
    page.content = content ?? page.content;
    if (status) page.status = status;
    await page.save();

    res.status(200).json({ success: true, message: "Page updated successfully", data: page });
  } catch (err) {
    console.error("[updatePage]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── TOGGLE publish status ─────────────────────────────────────────────────────
export async function togglePageStatusController(req: Request, res: Response): Promise<void> {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found" });
      return;
    }
    page.status = page.status === "published" ? "draft" : "published";
    await page.save();
    res.status(200).json({ success: true, message: `Page ${page.status}`, data: page });
  } catch (err) {
    console.error("[togglePageStatus]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── DELETE page ───────────────────────────────────────────────────────────────
export async function deletePageController(req: Request, res: Response): Promise<void> {
  try {
    const page = await Page.findByIdAndDelete(req.params.id);
    if (!page) {
      res.status(404).json({ success: false, message: "Page not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Page deleted successfully" });
  } catch (err) {
    console.error("[deletePage]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
