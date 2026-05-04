import { Request, Response } from "express";
import {
  extractFileInfo,
  createFileUrl,
  createFileUrls,
  createFileUrlFromPath,
  deleteFile,
} from "../utils/fileUploadHelper.js";

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
 * Delete uploaded file
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

export default {
  uploadSingleImageController,
  uploadMultipleImagesController,
  uploadProductMediaController,
  uploadAvatarController,
  deleteFileController,
};
