import express from "express";
import {
  uploadSingleImageController,
  uploadMultipleImagesController,
  uploadProductMediaController,
  uploadAvatarController,
  deleteFileController,
  // Cloudinary-based controllers
  uploadSingleImageCloudinaryController,
  uploadMultipleImagesCloudinaryController,
  uploadProductMediaCloudinaryController,
  uploadAvatarCloudinaryController,
  deleteCloudinaryResourceController,
} from "../../controllers/uploadController.js";
import {
  uploadImage,
  uploadImages,
  uploadProductMedia,
  uploadAvatar,
  uploadImageMemory,
  uploadImagesMemory,
  uploadProductMediaMemory,
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

// Delete file (local disk)
router.delete("/upload/:filename", verifyToken, deleteFileController);

// ========================================================================
// CLOUDINARY ROUTES (uses memory storage)
// ========================================================================

// Single image upload to Cloudinary
router.post(
  "/upload/cloudinary/image",
  verifyToken,
  uploadImageMemory.single("image"),
  handleMulterError,
  requireSingleFile("image"),
  uploadSingleImageCloudinaryController
);

// Multiple images upload to Cloudinary
router.post(
  "/upload/cloudinary/images",
  verifyToken,
  uploadImagesMemory.array("images", 10),
  handleMulterError,
  uploadMultipleImagesCloudinaryController
);

// Product media upload to Cloudinary (thumbnail + gallery)
router.post(
  "/upload/cloudinary/product-media",
  verifyToken,
  uploadProductMediaMemory.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  handleMulterError,
  uploadProductMediaCloudinaryController
);

// Avatar upload to Cloudinary
router.post(
  "/upload/cloudinary/avatar",
  verifyToken,
  uploadImageMemory.single("avatar"),
  handleMulterError,
  requireSingleFile("avatar"),
  uploadAvatarCloudinaryController
);

// Delete Cloudinary resource by public_id
router.delete("/upload/cloudinary/:publicId", verifyToken, deleteCloudinaryResourceController);

export default router;
