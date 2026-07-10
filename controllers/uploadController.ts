import { Request, Response } from "express";
import {
  extractFileInfo,
  createFileUrlFromPath,
  deleteFile,
} from "../utils/fileUploadHelper.js";
import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
  deleteByUrl,
} from "../utils/uploadToCloudinary.js";

/**
 * Upload a single image
 * POST /api/upload/image
 */
export async function uploadSingleImageController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    const fileInfo = extractFileInfo(req.file);
    // Use the full path from multer to generate proper URL
    const fileUrl = createFileUrlFromPath(req.file.path);

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        url: fileUrl,
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        size: fileInfo.sizeFormatted,
        mimetype: fileInfo.mimetype,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Upload multiple images
 * POST /api/upload/images
 */
export async function uploadMultipleImagesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const filesInfo = req.files.map((file) => {
      const info = extractFileInfo(file);
      return {
        url: createFileUrlFromPath(file.path),
        filename: info.filename,
        originalName: info.originalName,
        size: info.sizeFormatted,
        mimetype: info.mimetype,
      };
    });

    res.status(200).json({
      success: true,
      message: `${req.files.length} image(s) uploaded successfully`,
      data: {
        files: filesInfo,
        count: req.files.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Upload product media (thumbnail + gallery)
 * POST /api/upload/product-media
 */
export async function uploadProductMediaController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || (!files.thumbnail && !files.gallery)) {
      res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const result: any = {};

    // Process thumbnail
    if (files.thumbnail && files.thumbnail[0]) {
      const thumbnailInfo = extractFileInfo(files.thumbnail[0]);
      result.thumbnail = {
        url: createFileUrlFromPath(files.thumbnail[0].path),
        filename: thumbnailInfo.filename,
        size: thumbnailInfo.sizeFormatted,
      };
    }

    // Process gallery
    if (files.gallery && files.gallery.length > 0) {
      result.gallery = files.gallery.map((file) => {
        const info = extractFileInfo(file);
        return {
          url: createFileUrlFromPath(file.path),
          filename: info.filename,
          size: info.sizeFormatted,
        };
      });
    }

    res.status(200).json({
      success: true,
      message: "Product media uploaded successfully",
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Upload user avatar
 * POST /api/upload/avatar
 */
export async function uploadAvatarController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    const fileInfo = extractFileInfo(req.file);
    const fileUrl = createFileUrlFromPath(req.file.path);

    // Here you would typically update the user's avatar in the database
    // await User.findByIdAndUpdate(userId, { avatar: fileUrl });

    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      data: {
        url: fileUrl,
        filename: fileInfo.filename,
        size: fileInfo.sizeFormatted,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Delete uploaded file (local disk)
 * DELETE /api/upload/:filename
 */
export async function deleteFileController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { filename } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Construct file path
    const filePath = `uploads/${filename}`;

    // Delete file
    const deleted = await deleteFile(filePath);

    if (deleted) {
      res.status(200).json({
        success: true,
        message: "File deleted successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "File not found or already deleted",
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

// ========================================================================
// CLOUDINARY-BASED CONTROLLERS
// These use memory storage (req.file.buffer) and upload to Cloudinary.
// ========================================================================

/**
 * Upload a single image to Cloudinary
 * POST /api/upload/cloudinary/image
 */
export async function uploadSingleImageCloudinaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    const { buffer, originalname, mimetype, size } = req.file;

    const result = await uploadToCloudinary(buffer, {
      folder: "uploads/images",
      useFilename: true,
    });

    res.status(200).json({
      success: true,
      message: "Image uploaded to Cloudinary successfully",
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        originalName: originalname,
        size: `${(result.bytes / 1024).toFixed(2)} KB`,
        mimetype,
        width: result.width,
        height: result.height,
        format: result.format,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Upload multiple images to Cloudinary
 * POST /api/upload/cloudinary/images
 */
export async function uploadMultipleImagesCloudinaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const uploadedFiles = req.files as Express.Multer.File[];

    const results = await uploadMultipleToCloudinary(uploadedFiles, {
      folder: "uploads/images",
    });

    const files = results.map((r, i) => ({
      url: r.secure_url,
      publicId: r.public_id,
      originalName: uploadedFiles[i].originalname,
      size: `${(r.bytes / 1024).toFixed(2)} KB`,
      mimetype: uploadedFiles[i].mimetype,
      width: r.width,
      height: r.height,
      format: r.format,
    }));

    res.status(200).json({
      success: true,
      message: `${files.length} image(s) uploaded to Cloudinary successfully`,
      data: {
        files,
        count: files.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Upload product media (thumbnail + gallery) to Cloudinary
 * POST /api/upload/cloudinary/product-media
 */
export async function uploadProductMediaCloudinaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || (!files.thumbnail && !files.gallery)) {
      res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const result: Record<string, unknown> = {};

    // Upload thumbnail
    if (files.thumbnail?.[0]) {
      const thumbResult = await uploadToCloudinary(files.thumbnail[0].buffer, {
        folder: "uploads/products/thumbnails",
        useFilename: true,
      });
      result.thumbnail = {
        url: thumbResult.secure_url,
        publicId: thumbResult.public_id,
        width: thumbResult.width,
        height: thumbResult.height,
        size: `${(thumbResult.bytes / 1024).toFixed(2)} KB`,
      };
    }

    // Upload gallery images
    if (files.gallery && files.gallery.length > 0) {
      const galleryResults = await uploadMultipleToCloudinary(files.gallery, {
        folder: "uploads/products/gallery",
      });
      result.gallery = galleryResults.map((r) => ({
        url: r.secure_url,
        publicId: r.public_id,
        width: r.width,
        height: r.height,
        size: `${(r.bytes / 1024).toFixed(2)} KB`,
      }));
    }

    res.status(200).json({
      success: true,
      message: "Product media uploaded to Cloudinary successfully",
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Upload user avatar to Cloudinary (with old avatar deletion)
 * POST /api/upload/cloudinary/avatar
 */
export async function uploadAvatarCloudinaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    // Check if old avatar Cloudinary URL exists and delete it
    // (the actual user model update is done in the caller controller)
    const oldAvatarUrl = req.body.oldAvatarUrl as string | undefined;
    if (oldAvatarUrl) {
      // Fire-and-forget: don't block on deletion failure
      deleteByUrl(oldAvatarUrl).catch((err) =>
        console.warn("[Cloudinary] Failed to delete old avatar:", err)
      );
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `users/${userId}/avatar`,
      useFilename: true,
    });

    res.status(200).json({
      success: true,
      message: "Avatar uploaded to Cloudinary successfully",
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        size: `${(result.bytes / 1024).toFixed(2)} KB`,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

/**
 * Delete a Cloudinary resource by public_id
 * DELETE /api/upload/cloudinary/:publicId
 */
export async function deleteCloudinaryResourceController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { publicId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "publicId is required",
      });
      return;
    }

    const result = await deleteFromCloudinary(publicId);

    res.status(200).json({
      success: true,
      message: "Cloudinary resource deleted successfully",
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
}

export default {
  // Disk-based controllers
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
};
