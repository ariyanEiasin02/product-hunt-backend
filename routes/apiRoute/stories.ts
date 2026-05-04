import { Router } from "express";
import { verifyToken, isAdmin } from "../../middleware/authMiddleware.js";
import { uploadImage } from "../../config/multer.js";
import {
  getStoriesController,
  getStoryTagsController,
  getStoryBySlugController,
  storySSEController,
  getAdminStoriesController,
  getAdminStoryByIdController,
  createStoryController,
  updateStoryController,
  deleteStoryController,
  toggleFeaturedController,
} from "../../controllers/storyController.js";

const router = Router();

// ── Admin routes (must come before /:slug to avoid conflicts) ──
router.get("/admin/all", verifyToken, isAdmin, getAdminStoriesController);
router.get("/admin/:id", verifyToken, isAdmin, getAdminStoryByIdController);
router.post(
  "/admin",
  verifyToken,
  isAdmin,
  uploadImage.fields([{ name: "coverImage", maxCount: 1 }]),
  createStoryController
);
router.put(
  "/admin/:id",
  verifyToken,
  isAdmin,
  uploadImage.fields([{ name: "coverImage", maxCount: 1 }]),
  updateStoryController
);
router.delete("/admin/:id", verifyToken, isAdmin, deleteStoryController);
router.patch(
  "/admin/:id/feature",
  verifyToken,
  isAdmin,
  toggleFeaturedController
);

// ── Public routes ──
router.get("/", getStoriesController);
router.get("/tags", getStoryTagsController);
router.get("/events", storySSEController);  
router.get("/:slug", getStoryBySlugController); 

export default router;
