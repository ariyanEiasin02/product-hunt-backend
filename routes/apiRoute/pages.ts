import { Router } from "express";
import {
  getAllPagesController,
  getPageByIdController,
  getPageBySlugController,
  createPageController,
  updatePageController,
  togglePageStatusController,
  deletePageController,
} from "../../controllers/pageController.js";
import { verifyToken, isAdmin } from "../../middleware/authMiddleware.js";

const router = Router();

// Public – fetch a published page by slug (used by frontend /pages/[slug])
router.get("/slug/:slug", getPageBySlugController);

// Admin – list all pages
router.get("/", verifyToken, isAdmin, getAllPagesController);

// Admin – get single page by ID (for edit form)
router.get("/:id", verifyToken, isAdmin, getPageByIdController);

// Admin – create page
router.post("/", verifyToken, isAdmin, createPageController);

// Admin – update page
router.put("/:id", verifyToken, isAdmin, updatePageController);

// Admin – toggle publish/draft
router.patch("/:id/toggle-status", verifyToken, isAdmin, togglePageStatusController);

// Admin – delete page
router.delete("/:id", verifyToken, isAdmin, deletePageController);

export default router;
