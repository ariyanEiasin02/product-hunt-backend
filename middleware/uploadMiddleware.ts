import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

/**
 * Error handler middleware for multer file upload errors
 */
export function handleMulterError(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof MulterError) {
    // Multer-specific errors
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        res.status(400).json({
          success: false,
          message: "File size exceeds the maximum allowed limit",
          error: err.message,
        });
        return;

      case "LIMIT_FILE_COUNT":
        res.status(400).json({
          success: false,
          message: "Too many files uploaded",
          error: err.message,
        });
        return;

      case "LIMIT_UNEXPECTED_FILE":
        res.status(400).json({
          success: false,
          message: "Unexpected field in file upload",
          error: err.message,
        });
        return;

      case "LIMIT_PART_COUNT":
        res.status(400).json({
          success: false,
          message: "Too many parts in multipart data",
          error: err.message,
        });
        return;

      case "LIMIT_FIELD_KEY":
        res.status(400).json({
          success: false,
          message: "Field name too long",
          error: err.message,
        });
        return;

      case "LIMIT_FIELD_VALUE":
        res.status(400).json({
          success: false,
          message: "Field value too long",
          error: err.message,
        });
        return;

      case "LIMIT_FIELD_COUNT":
        res.status(400).json({
          success: false,
          message: "Too many fields",
          error: err.message,
        });
        return;

      default:
        res.status(400).json({
          success: false,
          message: "File upload error",
          error: err.message,
        });
        return;
    }
  } else if (err) {
    // Custom file filter errors or other errors
    res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
    return;
  }

  next();
}

/**
 * Middleware to validate required files are uploaded
 */
export function requireFiles(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const missingFields: string[] = [];

    fields.forEach((field) => {
      if (!files || !files[field] || files[field].length === 0) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required file(s): ${missingFields.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to validate single file upload
 */
export function requireSingleFile(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: `${fieldName} file is required`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to add file URLs to request object
 * Useful when files are saved to disk and you want to create accessible URLs
 */
export function addFileUrls(baseUrl: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.file) {
      (req as any).fileUrl = `${baseUrl}/${req.file.filename}`;
    }

    if (req.files) {
      if (Array.isArray(req.files)) {
        (req as any).fileUrls = req.files.map(
          (file) => `${baseUrl}/${file.filename}`
        );
      } else {
        const fileUrls: { [key: string]: string | string[] } = {};
        Object.keys(req.files).forEach((fieldname) => {
          const files = (req.files as any)[fieldname];
          if (Array.isArray(files)) {
            fileUrls[fieldname] = files.map(
              (file) => `${baseUrl}/${file.filename}`
            );
          } else {
            fileUrls[fieldname] = `${baseUrl}/${files.filename}`;
          }
        });
        (req as any).fileUrls = fileUrls;
      }
    }

    next();
  };
}

/**
 * Middleware to validate file dimensions for images
 * Requires sharp library: npm install sharp @types/sharp
 */
export async function validateImageDimensions(
  minWidth: number,
  minHeight: number,
  maxWidth?: number,
  maxHeight?: number
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // This is a placeholder - implement with sharp if needed
      // const sharp = require('sharp');
      // const metadata = await sharp(req.file.buffer).metadata();
      // Validate dimensions...
      
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Error validating image dimensions",
      });
    }
  };
}

/**
 * Clean up uploaded files in case of error
 */
export function cleanupFiles(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Clean up uploaded files if there's an error
  if (err && req.file) {
    const fs = require("fs");
    fs.unlink(req.file.path, (unlinkErr: any) => {
      if (unlinkErr) console.error("Error deleting file:", unlinkErr);
    });
  }

  if (err && req.files) {
    const fs = require("fs");
    if (Array.isArray(req.files)) {
      req.files.forEach((file) => {
        fs.unlink(file.path, (unlinkErr: any) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      });
    } else {
      Object.values(req.files).forEach((files: any) => {
        if (Array.isArray(files)) {
          files.forEach((file) => {
            fs.unlink(file.path, (unlinkErr: any) => {
              if (unlinkErr) console.error("Error deleting file:", unlinkErr);
            });
          });
        }
      });
    }
  }

  next(err);
}

export default {
  handleMulterError,
  requireFiles,
  requireSingleFile,
  addFileUrls,
  validateImageDimensions,
  cleanupFiles,
};
