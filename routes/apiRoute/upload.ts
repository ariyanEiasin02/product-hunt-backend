import express from "express";
import {
  uploadSingleImageController,
  uploadMultipleImagesController,
  uploadProductMediaController,
  uploadAvatarController,
  deleteFileController,
} from "../../controllers/uploadController.js";
import {
  uploadImage,
  uploadImages,
  uploadProductMedia,
  uploadAvatar,
} from "../../config/multer.js";
import {
  handleMulterError,
  requireSingleFile,
} from "../../middleware/uploadMiddleware.js";
import { verifyToken } from "../../middleware/authMiddleware.js";

const router = express.Router();

// Single image upload
router.post(
  "/upload/image",
  verifyToken,
  uploadImage.single("image"),
  handleMulterError,
  requireSingleFile("image"),
  uploadSingleImageController
);

// Multiple images upload
router.post(
  "/upload/images",
  verifyToken,
  uploadImages.array("images", 10),
  handleMulterError,
  uploadMultipleImagesController
);

// Product media upload (thumbnail + gallery)
router.post(
  "/upload/product-media",
  verifyToken,
  uploadProductMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  handleMulterError,
  uploadProductMediaController
);

// Avatar upload
router.post(
  "/upload/avatar",
  verifyToken,
  uploadAvatar.single("avatar"),
  handleMulterError,
  requireSingleFile("avatar"),
  uploadAvatarController
);

// Delete file
router.delete("/upload/:filename", verifyToken, deleteFileController);

export default router;
