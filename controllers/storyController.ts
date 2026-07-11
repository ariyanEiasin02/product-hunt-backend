import { Request, Response } from "express";
import Story from "../models/storySchema.js";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

// ── SSE clients for real-time updates ──
const sseClients: Set<Response> = new Set();

export function storySSEController(req: Request, res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  sseClients.add(res);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

function broadcastSSE(event: string, data: any): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  });
}

// ── GET /api/stories — List published stories with search, tags, pagination ──
export async function getStoriesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      search,
      tag,
      page = "1",
      limit = "12",
      featured,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = { status: "published" };

    // Search across title, summary, content, tags
    if (search && typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { title: searchRegex },
        { summary: searchRegex },
        { content: searchRegex },
        { tags: searchRegex },
      ];
    }

    // Tag filtering (supports multiple tags via ?tag=AI&tag=Design)
    // Also handles hyphenated tags (e.g., "how-to" matches "how to")
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      const normalizedTags: string[] = [];
      for (const t of tags) {
        const trimmed = (t as string).trim().toLowerCase();
        normalizedTags.push(trimmed);
        // Also match hyphenated ↔ spaced versions
        if (trimmed.includes("-")) {
          normalizedTags.push(trimmed.replace(/-/g, " "));
        } else if (trimmed.includes(" ")) {
          normalizedTags.push(trimmed.replace(/\s+/g, "-"));
        }
      }
      filter.tags = { $in: normalizedTags };
    }

    // Featured filter
    if (featured === "true") {
      filter.isFeatured = true;
    }

    const [stories, total] = await Promise.all([
      Story.find(filter)
        .select("-content")
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Story.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: stories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      },
    });
  } catch (error: any) {
    console.error("getStoriesController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stories",
      error: error.message,
    });
  }
}

// ── GET /api/stories/tags — Get all unique tags ──
export async function getStoryTagsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tags = await Story.distinct("tags", { status: "published" });
    res.status(200).json({ success: true, data: tags.sort() });
  } catch (error: any) {
    console.error("getStoryTagsController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tags",
      error: error.message,
    });
  }
}

// ── GET /api/stories/:slug — Get single story by slug ──
export async function getStoryBySlugController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    let { slug } = req.params;

    // Sanitize slug from URL (handles encoded spaces, etc.)
    slug = decodeURIComponent(slug)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const story = await Story.findOne({ slug, status: "published" }).lean();

    if (!story) {
      res.status(404).json({
        success: false,
        message: "Story not found",
      });
      return;
    }

    // Fetch related stories (same tags, excluding current)
    const relatedStories = await Story.find({
      _id: { $ne: story._id },
      status: "published",
      tags: { $in: story.tags },
    })
      .select("-content")
      .sort({ publishedAt: -1 })
      .limit(4)
      .lean();

    res.status(200).json({
      success: true,
      data: story,
      relatedStories,
    });
  } catch (error: any) {
    console.error("getStoryBySlugController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch story",
      error: error.message,
    });
  }
}

// ── ADMIN: GET /api/stories/admin/all — List all stories (drafts + published) ──
export async function getAdminStoriesController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const {
      search,
      status,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, parseInt(limit as string, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};

    if (status && (status === "draft" || status === "published")) {
      filter.status = status;
    }

    if (search && typeof search === "string" && search.trim()) {
      filter.$or = [
        { title: new RegExp(search.trim(), "i") },
        { summary: new RegExp(search.trim(), "i") },
      ];
    }

    const [stories, total] = await Promise.all([
      Story.find(filter)
        .select("-content")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Story.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: stories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("getAdminStoriesController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stories",
      error: error.message,
    });
  }
}

// ── ADMIN: GET /api/stories/admin/:id — Get single story for editing ──
export async function getAdminStoryByIdController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const story = await Story.findById(id).lean();

    if (!story) {
      res.status(404).json({ success: false, message: "Story not found" });
      return;
    }

    res.status(200).json({ success: true, data: story });
  } catch (error: any) {
    console.error("getAdminStoryByIdController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch story",
      error: error.message,
    });
  }
}

// ── ADMIN: POST /api/stories/admin — Create story ──
export async function createStoryController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    let {
      title,
      slug,
      summary,
      content,
      tags,
      authorName,
      authorAvatar,
      status,
      isFeatured,
    } = req.body;

    if (!title || !content) {
      res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
      return;
    }

    // Handle cover image upload to Cloudinary
    let coverImage = req.body.coverImage || "";
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files?.coverImage && files.coverImage[0]) {
      const result = await uploadToCloudinary(files.coverImage[0].buffer, {
        folder: "stories/cover-images",
      });
      coverImage = result.secure_url;
    }

    // Auto-generate slug or sanitize provided slug
    const sanitizeSlug = (text: string) =>
      text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

    if (!slug) {
      slug = sanitizeSlug(title);
    } else {
      slug = sanitizeSlug(slug);
    }

    // Check slug uniqueness
    const existing = await Story.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Parse tags
    if (typeof tags === "string") {
      tags = tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
    }

    const story = new Story({
      title,
      slug,
      summary: summary || "",
      content,
      coverImage,
      tags: tags || [],
      author: {
        name: authorName || "Product Hunt",
        avatar: authorAvatar || "",
      },
      status: status || "draft",
      isFeatured: isFeatured === "true" || isFeatured === true,
      publishedAt: status === "published" ? new Date() : null,
    });

    await story.save();

    // Broadcast SSE event if published
    if (story.status === "published") {
      broadcastSSE("story_created", {
        _id: story._id,
        title: story.title,
        slug: story.slug,
        summary: story.summary,
        coverImage: story.coverImage,
        tags: story.tags,
        author: story.author,
        publishedAt: story.publishedAt,
      });
    }

    res.status(201).json({
      success: true,
      message: "Story created successfully",
      data: story,
    });
  } catch (error: any) {
    console.error("createStoryController error:", error);

    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: "A story with this slug already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to create story",
      error: error.message,
    });
  }
}

// ── ADMIN: PUT /api/stories/admin/:id — Update story ──
export async function updateStoryController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    let {
      title,
      slug,
      summary,
      content,
      tags,
      authorName,
      authorAvatar,
      status,
      isFeatured,
    } = req.body;

    const story = await Story.findById(id);
    if (!story) {
      res.status(404).json({ success: false, message: "Story not found" });
      return;
    }

    // Handle cover image upload to Cloudinary
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files?.coverImage && files.coverImage[0]) {
      const result = await uploadToCloudinary(files.coverImage[0].buffer, {
        folder: "stories/cover-images",
      });
      story.coverImage = result.secure_url;
    } else if (req.body.coverImage !== undefined) {
      story.coverImage = req.body.coverImage;
    }

    // Update fields
    if (title) story.title = title;
    if (summary !== undefined) story.summary = summary;
    if (content) story.content = content;

    // Parse tags
    if (tags !== undefined) {
      if (typeof tags === "string") {
        story.tags = tags
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);
      } else if (Array.isArray(tags)) {
        story.tags = tags;
      }
    }

    if (authorName) story.author.name = authorName;
    if (authorAvatar !== undefined) story.author.avatar = authorAvatar;

    if (status) {
      // Track status change for publishedAt
      const wasPublished = story.status === "published";
      story.status = status;
      if (status === "published" && !wasPublished && !story.publishedAt) {
        story.publishedAt = new Date();
      }
    }

    if (isFeatured !== undefined) {
      story.isFeatured = isFeatured === "true" || isFeatured === true;
    }

    // Handle slug update — always sanitize
    if (slug) {
      const sanitizedSlug = slug
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (sanitizedSlug && sanitizedSlug !== story.slug) {
        const existing = await Story.findOne({ slug: sanitizedSlug, _id: { $ne: id } });
        if (existing) {
          res.status(400).json({
            success: false,
            message: "A story with this slug already exists",
          });
          return;
        }
        story.slug = sanitizedSlug;
      }
    }

    await story.save();

    // Broadcast SSE event
    broadcastSSE("story_updated", {
      _id: story._id,
      title: story.title,
      slug: story.slug,
      summary: story.summary,
      coverImage: story.coverImage,
      tags: story.tags,
      author: story.author,
      status: story.status,
      publishedAt: story.publishedAt,
    });

    res.status(200).json({
      success: true,
      message: "Story updated successfully",
      data: story,
    });
  } catch (error: any) {
    console.error("updateStoryController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update story",
      error: error.message,
    });
  }
}

// ── ADMIN: DELETE /api/stories/admin/:id — Delete story ──
export async function deleteStoryController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const story = await Story.findByIdAndDelete(id);
    if (!story) {
      res.status(404).json({ success: false, message: "Story not found" });
      return;
    }

    // Broadcast SSE event
    broadcastSSE("story_deleted", { _id: story._id, slug: story.slug });

    res.status(200).json({
      success: true,
      message: "Story deleted successfully",
    });
  } catch (error: any) {
    console.error("deleteStoryController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete story",
      error: error.message,
    });
  }
}

// ── ADMIN: PATCH /api/stories/admin/:id/feature — Toggle featured ──
export async function toggleFeaturedController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const story = await Story.findById(id);
    if (!story) {
      res.status(404).json({ success: false, message: "Story not found" });
      return;
    }

    story.isFeatured = !story.isFeatured;
    await story.save();

    broadcastSSE("story_updated", {
      _id: story._id,
      isFeatured: story.isFeatured,
    });

    res.status(200).json({
      success: true,
      message: story.isFeatured
        ? "Story marked as featured"
        : "Story removed from featured",
      data: { isFeatured: story.isFeatured },
    });
  } catch (error: any) {
    console.error("toggleFeaturedController error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle featured status",
      error: error.message,
    });
  }
}
