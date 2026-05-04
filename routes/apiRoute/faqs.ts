import { Router } from "express";
import {
  getAllFaqsController,
  getPublishedFaqsController,
  getFaqByIdController,
  createFaqController,
  updateFaqController,
  toggleFaqStatusController,
  deleteFaqController,
} from "../../controllers/faqController.js";
import { verifyToken, isAdmin } from "../../middleware/authMiddleware.js";

const router = Router();

// Public – get published FAQs (used by frontend)
router.get("/public", getPublishedFaqsController);
router.get("/product-guides", getPublishedFaqsController);
// Admin routes
router.get("/",verifyToken, isAdmin, getAllFaqsController);
router.get("/:id",verifyToken, isAdmin, getFaqByIdController);
router.post("/",verifyToken, isAdmin, createFaqController);
router.put("/:id",verifyToken, isAdmin, updateFaqController);
router.patch("/:id/toggle-status", verifyToken, isAdmin, toggleFaqStatusController);
router.delete("/:id",verifyToken, isAdmin, deleteFaqController);

export default router;
