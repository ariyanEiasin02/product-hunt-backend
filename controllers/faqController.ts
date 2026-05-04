import { Request, Response } from "express";
import Faq from "../models/faqSchema.js";

// ── GET all FAQs (admin, paginated + search) ──────────────────────────────────
export async function getAllFaqsController(req: Request, res: Response): Promise<void> {
  try {
    const page   = Math.max(1, parseInt(String(req.query.page  ?? 1), 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));
    const skip   = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer:   { $regex: search, $options: "i" } },
      ];
    }
    if (status === "published" || status === "draft") {
      filter.status = status;
    }

    const [faqs, total] = await Promise.all([
      Faq.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Faq.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: faqs,
      pagination: { total, page, limit, totalPages, hasMore: page < totalPages },
    });
  } catch (err) {
    console.error("[getAllFaqs]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET published FAQs (public) ───────────────────────────────────────────────
export async function getPublishedFaqsController(req: Request, res: Response): Promise<void> {
  try {
    const faqs = await Faq.find({ status: "published" }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: faqs });
  } catch (err) {
    console.error("[getPublishedFaqs]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── GET single FAQ by ID ──────────────────────────────────────────────────────
export async function getFaqByIdController(req: Request, res: Response): Promise<void> {
  try {
    const faq = await Faq.findById(req.params.id);
    if (!faq) {
      res.status(404).json({ success: false, message: "FAQ not found" });
      return;
    }
    res.status(200).json({ success: true, data: faq });
  } catch (err) {
    console.error("[getFaqById]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── CREATE FAQ ────────────────────────────────────────────────────────────────
export async function createFaqController(req: Request, res: Response): Promise<void> {
  try {
    const { question, answer, status } = req.body;
    if (!question || !answer) {
      res.status(400).json({ success: false, message: "Question and answer are required" });
      return;
    }
    const faq = await Faq.create({
      question: question.trim(),
      answer: answer.trim(),
      status: status ?? "draft",
    });
    res.status(201).json({ success: true, message: "FAQ created successfully", data: faq });
  } catch (err) {
    console.error("[createFaq]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── UPDATE FAQ ────────────────────────────────────────────────────────────────
export async function updateFaqController(req: Request, res: Response): Promise<void> {
  try {
    const faq = await Faq.findById(req.params.id);
    if (!faq) {
      res.status(404).json({ success: false, message: "FAQ not found" });
      return;
    }
    const { question, answer, status } = req.body;
    if (question !== undefined) faq.question = question.trim();
    if (answer   !== undefined) faq.answer   = answer.trim();
    if (status   !== undefined) faq.status   = status;
    await faq.save();
    res.status(200).json({ success: true, message: "FAQ updated successfully", data: faq });
  } catch (err) {
    console.error("[updateFaq]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── TOGGLE FAQ STATUS ─────────────────────────────────────────────────────────
export async function toggleFaqStatusController(req: Request, res: Response): Promise<void> {
  try {
    const faq = await Faq.findById(req.params.id);
    if (!faq) {
      res.status(404).json({ success: false, message: "FAQ not found" });
      return;
    }
    faq.status = faq.status === "published" ? "draft" : "published";
    await faq.save();
    res.status(200).json({ success: true, message: `FAQ ${faq.status}`, data: faq });
  } catch (err) {
    console.error("[toggleFaqStatus]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── DELETE FAQ ────────────────────────────────────────────────────────────────
export async function deleteFaqController(req: Request, res: Response): Promise<void> {
  try {
    const faq = await Faq.findByIdAndDelete(req.params.id);
    if (!faq) {
      res.status(404).json({ success: false, message: "FAQ not found" });
      return;
    }
    res.status(200).json({ success: true, message: "FAQ deleted successfully" });
  } catch (err) {
    console.error("[deleteFaq]", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

