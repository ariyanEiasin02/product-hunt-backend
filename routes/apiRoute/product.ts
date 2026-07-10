import { Router } from "express";
import {
  createProductController,
  getProductsController,
  getProductBySlugController,
  getProductByIdController,
  updateProductController,
  updateProductStatusController,
  upvoteProductController,
  deleteProductController,
  getProductAlternativesController,
  getProductLaunchesController,
  getProductTeamController,
  saveProductController,
  createProductCloudinaryController,
  updateProductCloudinaryController
} from "../../controllers/productController.js";
import { isAdmin, verifyToken, optionalAuth } from "../../middleware/authMiddleware.js";
import { uploadProductMedia, uploadProductMediaMemory } from "../../config/multer.js";
import { handleMulterError } from "../../middleware/uploadMiddleware.js";

const router = Router();

// Create new product submission (with file upload support)
router.post(
  "/",
  uploadProductMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  handleMulterError,
  createProductController
);

// Update product (Admin only)
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  uploadProductMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  handleMulterError,
  updateProductController
);

// Get all products with filters
router.get("/", getProductsController);

// Admin routes (must come before /:slug to avoid conflicts)
router.get("/admin/:id", verifyToken, isAdmin, getProductByIdController);

// Delete and save routes
router.delete("/:id/delete", verifyToken,deleteProductController );
router.post("/:id/save",verifyToken,saveProductController);

// Product detail routes
router.get("/:slug", optionalAuth, getProductBySlugController);
router.get("/:slug/alternatives", optionalAuth, getProductAlternativesController);
router.get("/:slug/launches", optionalAuth, getProductLaunchesController);
router.get("/:slug/team", getProductTeamController);

// Update product status (admin only - add auth middleware later)
router.put("/:id/status", verifyToken, isAdmin, updateProductStatusController);

// Upvote a product
router.post("/:id/upvote", verifyToken, upvoteProductController);

// ========================================================================
// CLOUDINARY PRODUCT ROUTES (uses memory storage)
// ========================================================================

// Create product with Cloudinary media uploads
router.post(
  "/cloudinary",
  uploadProductMediaMemory.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  handleMulterError,
  createProductCloudinaryController
);

// Update product with Cloudinary media uploads (Admin only)
router.put(
  "/cloudinary/:id",
  verifyToken,
  isAdmin,
  uploadProductMediaMemory.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  handleMulterError,
  updateProductCloudinaryController
);

export default router;
