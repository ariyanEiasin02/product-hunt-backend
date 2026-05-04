import path from "path";
import fs from "fs";
import { promisify } from "util";

const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

/**
 * Create upload directories if they don't exist
 */
export async function createUploadDirectories(): Promise<void> {
  const directories = [
    "uploads",
    "uploads/products",
    "uploads/users",
    "uploads/images",
    "uploads/videos",
    "uploads/documents",
  ];

  for (const dir of directories) {
    try {
      await mkdirAsync(dir, { recursive: true });
    } catch (error) {
      if ((error as any).code !== "EEXIST") {
        console.error(`Error creating directory ${dir}:`, error);
      }
    }
  }
}

/**
 * Delete a file from the filesystem
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await unlinkAsync(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    return false;
  }
}

/**
 * Delete multiple files from the filesystem
 */
export async function deleteFiles(filePaths: string[]): Promise<void> {
  const deletePromises = filePaths.map((filePath) => deleteFile(filePath));
  await Promise.all(deletePromises);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * Validate file extension
 */
export function isValidFileExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const ext = getFileExtension(filename);
  return allowedExtensions.includes(ext);
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Generate a unique filename
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

  return `${sanitized}-${timestamp}-${random}${ext}`;
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Get file size
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Sanitize filename by removing special characters
 */
export function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename);
  const nameWithoutExt = path.basename(filename, ext);
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${sanitized}${ext}`;
}

/**
 * Extract file info from multer file
 */
export function extractFileInfo(file: Express.Multer.File) {
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    extension: getFileExtension(file.originalname),
  };
}

/**
 * Validate file size
 */
export function isValidFileSize(
  fileSize: number,
  maxSize: number
): boolean {
  return fileSize <= maxSize;
}

/**
 * Get MIME type category
 */
export function getMimeTypeCategory(mimetype: string): string {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.startsWith("application/pdf")) return "pdf";
  if (
    mimetype.includes("document") ||
    mimetype.includes("msword") ||
    mimetype.includes("officedocument")
  )
    return "document";
  return "other";
}

/**
 * Create file URL for serving
 * Automatically detects the subfolder based on common patterns
 */
export function createFileUrl(
  filename: string,
  subfolder?: string,
  baseUrl: string = process.env.BASE_URL || "http://localhost:5000"
): string {
  // If subfolder is explicitly provided, use it
  if (subfolder) {
    return `${baseUrl}/uploads/${subfolder}/${filename}`;
  }
  
  // Otherwise, return just the filename (path will be determined by multer storage)
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * Create file URL from full path
 * Extracts the relative path from uploads folder
 */
export function createFileUrlFromPath(
  filePath: string,
  baseUrl: string = process.env.BASE_URL || "http://localhost:5000"
): string {
  // Extract path after 'uploads/'
  const uploadsIndex = filePath.indexOf('uploads');
  if (uploadsIndex !== -1) {
    const relativePath = filePath.substring(uploadsIndex + 8); // +8 to skip 'uploads/'
    return `${baseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;
  }
  return `${baseUrl}/uploads/${filePath}`;
}

/**
 * Create multiple file URLs
 */
export function createFileUrls(
  filenames: string[],
  subfolder?: string,
  baseUrl: string = process.env.BASE_URL || "http://localhost:5000"
): string[] {
  return filenames.map((filename) => createFileUrl(filename, subfolder, baseUrl));
}

export default {
  createUploadDirectories,
  deleteFile,
  deleteFiles,
  getFileExtension,
  isValidFileExtension,
  formatFileSize,
  generateUniqueFilename,
  fileExists,
  getFileSize,
  sanitizeFilename,
  extractFileInfo,
  isValidFileSize,
  getMimeTypeCategory,
  createFileUrl,
  createFileUrlFromPath,
  createFileUrls,
};
