import { Router } from "express";
import {
  getAllGuidesController,
  getPublishedGuidesController,
  getProductGuidesFaqsController,
  getGuideBySlugController,
  getGuideByIdController,
  createGuideController,
  updateGuideController,
  toggleGuideStatusController,
  deleteGuideController,
} from "../../controllers/productGuideController.js";
import { verifyToken, isAdmin } from "../../middleware/authMiddleware.js";
import { uploadImageMemory } from "../../config/multer.js";
import { handleMulterError } from "../../middleware/uploadMiddleware.js";

const router = Router();

// Public routes
router.get("/public", getPublishedGuidesController);
router.get("/public-with-faqs", getProductGuidesFaqsController);
router.get("/slug/:slug",getGuideBySlugController);

// Admin routes
router.get("/", verifyToken, isAdmin, getAllGuidesController);
router.get("/:id",verifyToken, isAdmin, getGuideByIdController);
router.post("/",verifyToken, isAdmin, uploadImageMemory.single("image"), handleMulterError, createGuideController);
router.put("/:id", verifyToken, isAdmin, uploadImageMemory.single("image"), handleMulterError, updateGuideController);
router.patch("/:id/toggle-status", verifyToken, isAdmin, toggleGuideStatusController);
router.delete("/:id",verifyToken, isAdmin, deleteGuideController);

export default router;
